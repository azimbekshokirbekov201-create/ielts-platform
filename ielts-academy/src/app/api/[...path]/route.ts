import { unlink } from "node:fs/promises";
import { privatePath } from "@/server/local/client";
import { subscriptionRequest } from "@/server/subscriptions";
import { Store } from "@/server/local/engine";
import { prisma } from "@/server/local/database";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, serviceDb, userDb } from "@/server/local/client";
import {
  contentSchemas,
  onboardingSchema,
  roleDestination,
  uuid,
  writingCriteria,
  speakingCriteria,
  bandAverage,
} from "@/server/validation";
import { matchesFileType } from "@/server/uploads";
import { evaluateAi } from "@/server/ai";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const result = (data: unknown, status = 200) =>
  Response.json({ data }, { status, headers: { "Cache-Control": "no-store" } });
function checked<T>(r: { data?: T; error: unknown }): T {
  if (r.error) {
    if (r.error instanceof ApiError) throw r.error;
    throw new ApiError(409, "operation_rejected");
  }
  return r.data as T;
}
async function input(req: Request) {
  const raw = await req.text();
  if (raw.length > 100000) throw new ApiError(413, "too_large");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "invalid_input");
  }
}
async function rate(key: string, limit: number) {
  const r = await serviceDb().rpc("consume_rate_limit", {
    k: key,
    max_hits: limit,
    window_seconds: 60,
  });
  if (r.error) throw new ApiError(503, "rate_limit_unavailable");
  if (!r.data) throw new ApiError(429, "rate_limited");
}
async function handler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path,
      key = path.join("/"),
      method = req.method,
      url = new URL(req.url);
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      const expected = new URL(process.env.APP_URL || req.url).origin;
      if (!origin || origin !== expected) throw new ApiError(403, "forbidden");
      if (Number(req.headers.get("content-length") || 0) > 27000000)
        throw new ApiError(413, "too_large");
    }
    const pageOffset = Math.max(
      0,
      Math.min(Number(url.searchParams.get("page")) || 0, 10000),
    );
    const db = await userDb();
    if (path[0] === "auth" && method === "POST") {
      const address =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
      // Vercel overwrites x-forwarded-for. Use the trusted ingress header on other hosts.
      const body = await input(req);
      await rate(
        "auth:" + createHash("sha256").update(address).digest("hex"),
        10,
      );
      if (key === "auth/logout") {
        checked(await db.auth.signOut());
        return result(true);
      }
      if (key === "auth/reset") {
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user) throw new ApiError(401, "unauthorized");
        const { password } = z
          .object({ password: z.string().min(12).max(128) })
          .parse(body);
        if ((await db.auth.updateUser({ password })).error)
          throw new ApiError(400, "auth_failed");
        return result(true);
      }
      const { email } = z.object({ email: z.email().max(254) }).parse(body);
      const callback = new URL(
        "/auth/callback",
        process.env.APP_URL || url.origin,
      ).toString();
      if (key === "auth/forgot") {
        await db.auth.resetPasswordForEmail(email, {
          redirectTo: callback + "?next=reset",
        });
        return result({ message: "check_email" });
      }
      const { password } = z
        .object({ password: z.string().min(12).max(128) })
        .parse(body);
      if (key === "auth/register") {
        const { name } = z
          .object({ name: z.string().trim().min(1).max(100) })
          .parse(body);
        const r = await db.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: callback },
        });
        if (r.error) throw new ApiError(400, "auth_failed");
        return result({
          verificationRequired: !r.data.session,
          destination: r.data.session ? "/onboarding" : null,
        });
      }
      if (key === "auth/login") {
        const r = await db.auth.signInWithPassword({ email, password });
        if (r.error) throw new ApiError(401, "auth_failed");
        const roles = (
          checked(await db.from("user_roles").select("role")) || []
        ).map((x) => x.role);
        const ob = checked(
          await db
            .from("student_onboarding")
            .select("completed")
            .eq("user_id", r.data.user.id)
            .maybeSingle(),
        ) as { completed: boolean } | null;
        return result({
          destination: roleDestination(roles, ob?.completed || false),
        });
      }
      throw new ApiError(404, "not_found");
    }
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    if (error || !user) throw new ApiError(401, "unauthorized");
    if (method !== "GET") await rate("user:" + user.id, 90);
    const roles = (
      checked(
        await db.from("user_roles").select("role").eq("user_id", user.id),
      ) || []
    ).map((x) => x.role);
    if (path[0] === "subscription" || key.startsWith("admin/subscriptions"))
      return result(await subscriptionRequest(req, user.id, path));
    const admin = () => {
      if (!roles.includes("ADMIN")) throw new ApiError(403, "forbidden");
    };
    const teacher = () => {
      if (!roles.some((x) => ["ADMIN", "TEACHER"].includes(x)))
        throw new ApiError(403, "forbidden");
    };
    if (key === "me" && method === "GET") {
      const profile = checked(
        await db.from("profiles").select("*").eq("id", user.id).single(),
      );
      const preferences = checked(
        await db
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .single(),
      );
      const onboarding = checked(
        await db
          .from("student_onboarding")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ) as { completed: boolean } | null;
      return result({
        id: user.id,
        email: user.email,
        profile,
        preferences,
        roles,
        onboarding,
        destination: roleDestination(roles, onboarding?.completed || false),
      });
    }
    if (key === "profile" && method === "PATCH") {
      const p = z
        .object({ display_name: z.string().trim().min(1).max(100) })
        .strict()
        .parse(await input(req));
      return result(
        checked(
          await db
            .from("profiles")
            .update(p)
            .eq("id", user.id)
            .select()
            .single(),
        ),
      );
    }
    if (key === "preferences" && method === "PATCH") {
      const p = z
        .object({
          language: z.enum(["en", "uz", "ru"]).optional(),
          theme: z.enum(["light", "dark"]).optional(),
          ai_consent: z.boolean().optional(),
        })
        .strict()
        .parse(await input(req));
      return result(
        checked(
          await db
            .from("user_preferences")
            .update({ ...p, updated_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .select()
            .single(),
        ),
      );
    }
    if (key === "onboarding" && method === "PATCH") {
      const { answers, finish } = z
        .object({
          answers: onboardingSchema,
          finish: z.boolean().default(false),
        })
        .strict()
        .parse(await input(req));
      return result(
        checked(await db.rpc("save_onboarding", { p: answers, finish })),
      );
    }
    const catalogTables = [
      "courses",
      "lessons",
      "tests",
      "writing_tasks",
      "speaking_tasks",
      "mock_exams",
    ];
    if (
      path[0] === "catalog" &&
      method === "GET" &&
      catalogTables.includes(path[1])
    ) {
      const store = new Store(prisma, user.id);
      const rows = (await store.all(path[1]))
        .filter(
          (x) =>
            x.status === "published" &&
            (!url.searchParams.has("skill") ||
              x.skill === url.searchParams.get("skill")),
        )
        .sort((a, b) =>
          String(b.created_at).localeCompare(String(a.created_at)),
        );
      const selected = rows.slice(pageOffset * 20, pageOffset * 20 + 20);
      const output = [];
      for (const row of selected) {
        if (await store.visible(path[1], row)) output.push(row);
        else if (row.access_tier === "premium")
          output.push({
            id: row.id,
            title: row.title,
            skill: row.skill,
            variant: row.variant,
            status: row.status,
            access_tier: "premium",
            locked: true,
          });
      }
      return result(output);
    }
    if (
      path[0] === "task" &&
      method === "GET" &&
      ["writing_tasks", "speaking_tasks"].includes(path[1])
    )
      return result(
        checked(
          await db
            .from(path[1])
            .select("*")
            .eq("id", uuid.parse(path[2]))
            .single(),
        ),
      );
    if (path[0] === "course" && method === "GET") {
      const id = uuid.parse(path[1]);
      const course = checked(
        await db
          .from("courses")
          .select("*,course_modules(*,lessons(*,lesson_resources(*)))")
          .eq("id", id)
          .single(),
      );
      return result(course);
    }
    if (path[0] === "test" && method === "GET") {
      const id = uuid.parse(path[1]);
      return result(
        checked(
          await db
            .from("tests")
            .select(
              "*,test_sections(*,passages(*),questions(*,question_options(*)))",
            )
            .eq("id", id)
            .single(),
        ),
      );
    }
    if (path[0] === "attempts") {
      if (method === "GET") {
        if (path[1])
          return result(
            checked(
              await db
                .from("test_attempts")
                .select("*,student_answers(*)")
                .eq("id", uuid.parse(path[1]))
                .single(),
            ),
          );
        return result(
          checked(
            await db
              .from("test_attempts")
              .select("*,tests(title,skill)")
              .order("started_at", { ascending: false })
              .limit(100),
          ),
        );
      }
      if (method === "POST" && path.length === 1) {
        const p = z.object({ test_id: uuid }).parse(await input(req));
        return result(checked(await db.rpc("start_test", { t: p.test_id })));
      }
      const id = uuid.parse(path[1]);
      if (method === "PATCH") {
        const p = z
          .object({ answers: z.record(uuid, z.string().max(4000)) })
          .parse(await input(req));
        return result(
          checked(await db.rpc("save_answers", { a: id, p: p.answers })),
        );
      }
      if (method === "POST" && path[2] === "submit")
        return result(checked(await db.rpc("submit_test", { a: id })));
    }
    if (key === "writing" && method === "POST") {
      const p = z
        .object({
          task_id: uuid,
          submission_id: uuid.optional(),
          body: z.string().max(50000).nullable().default(null),
          finish: z.boolean().default(false),
        })
        .parse(await input(req));
      return result(
        checked(
          await db.rpc("writing_draft", {
            t: p.task_id,
            body_text: p.body,
            finish: p.finish,
            submission: p.submission_id || null,
          }),
        ),
      );
    }
    if (key === "speaking" && method === "POST") {
      const p = z
        .object({ task_id: uuid, path: z.string().min(1).max(1000) })
        .parse(await input(req));
      return result(
        checked(await db.rpc("add_recording", { t: p.task_id, p: p.path })),
      );
    }
    if (key === "enroll" && method === "POST") {
      const p = z.object({ course_id: uuid }).parse(await input(req));
      return result(checked(await db.rpc("enroll_course", { c: p.course_id })));
    }
    if (key === "complete" && method === "POST") {
      const p = z.object({ lesson_id: uuid }).parse(await input(req));
      return result(
        checked(await db.rpc("complete_lesson", { l: p.lesson_id })),
      );
    }
    if (key === "dashboard" && method === "GET") {
      const tables = [
        "test_attempts",
        "lesson_progress",
        "course_enrollments",
        "learning_activity_events",
        "student_achievements",
        "assignments",
      ] as const;
      const rows = await Promise.all(
        tables.map((t) =>
          db
            .from(t)
            .select(t === "assignments" ? "*,tests(skill)" : "*")
            .eq(t === "assignments" ? "student_id" : "user_id", user.id)
            .limit(1000),
        ),
      );
      return result(
        Object.fromEntries(rows.map((r, i) => [tables[i], checked(r)])),
      );
    }
    if (key === "submissions" && method === "GET") {
      const writing = checked(
        await db
          .from("writing_submissions")
          .select("*,writing_tasks(title,prompt),writing_evaluations(*)")
          .order("created_at", { ascending: false })
          .limit(100),
      );
      const speaking = checked(
        await db
          .from("speaking_recordings")
          .select(
            "*,speaking_tasks(title,prompt),speaking_evaluations(*),speaking_transcripts(*)",
          )
          .order("created_at", { ascending: false })
          .limit(100),
      );
      return result({ writing, speaking });
    }
    if (key === "review" && method === "POST") {
      teacher();
      const p = z
        .object({
          kind: z.enum(["writing", "speaking"]),
          id: uuid,
          band: z.number().min(0).max(9).multipleOf(0.5),
          criteria: z.record(
            z.string(),
            z.number().min(0).max(9).multipleOf(0.5),
          ),
          feedback: z.string().min(1).max(20000),
        })
        .parse(await input(req));
      return result(
        checked(
          await db.rpc("review_submission", {
            k: p.kind,
            s: p.id,
            b: bandAverage(
              Object.values(
                (p.kind === "writing"
                  ? writingCriteria
                  : speakingCriteria
                ).parse(p.criteria),
              ),
            ),
            c: p.criteria,
            f: p.feedback,
          }),
        ),
      );
    }
    if (key === "ai" && method === "POST") {
      const p = z
        .object({ kind: z.enum(["writing", "speaking"]), id: uuid })
        .parse(await input(req));
      return result(await evaluateAi(db, user.id, p.kind, p.id));
    }
    if (path[0] === "mock") {
      if (method === "GET")
        return result(
          checked(
            await db
              .from("mock_exams")
              .select("*,mock_exam_sections(*)")
              .eq("id", uuid.parse(path[1]))
              .single(),
          ),
        );
      if (method === "POST" && path.length === 1) {
        const p = z.object({ exam_id: uuid }).parse(await input(req));
        return result(checked(await db.rpc("start_mock", { m: p.exam_id })));
      }
      if (method === "PATCH") {
        const p = z
          .object({ section_id: uuid, result_id: uuid })
          .parse(await input(req));
        return result(
          checked(
            await db.rpc("link_mock_section", {
              a: uuid.parse(path[1]),
              s: p.section_id,
              r: p.result_id,
            }),
          ),
        );
      }
    }
    if (key === "mock-results" && method === "GET") {
      const rows =
        checked(
          await db
            .from("mock_exam_attempts")
            .select("*,mock_exams(title),mock_exam_results(*)")
            .order("started_at", { ascending: false })
            .limit(100),
        ) || [];
      return result(
        await Promise.all(
          rows.map(async (row) => ({
            ...row,
            scorecard: checked(await db.rpc("mock_scorecard", { a: row.id })),
          })),
        ),
      );
    }
    if (key === "media-remove" && method === "POST") {
      teacher();
      const p = z
        .object({ path: z.string().max(1000) })
        .parse(await input(req));
      const target = privatePath("course-media", p.path);
      if (!roles.includes("ADMIN") && p.path.split("/")[0] !== user.id)
        throw new ApiError(403, "forbidden");
      await prisma.$transaction(async (tx) => {
        await tx.rateLimit.upsert({
          where: { key: "media-lock" },
          create: { key: "media-lock", start: new Date(), hits: 1 },
          update: { hits: { increment: 1 } },
        });
        const store = new Store(tx, user.id, true);
        for (const row of await tx.entity.findMany())
          if (
            !["media_assets", "upload_metadata", "audit_logs"].includes(
              row.kind,
            ) &&
            JSON.stringify(row.data).includes(p.path)
          )
            throw new ApiError(409, "file_in_use");
        await unlink(target).catch((e) => {
          if (e.code !== "ENOENT") throw e;
        });
        for (const row of await store.all("media_assets"))
          if (row.storage_path === p.path)
            await tx.entity.delete({
              where: { kind_id: { kind: "media_assets", id: row.id } },
            });
        await tx.entity.deleteMany({
          where: { kind: "upload_metadata", id: "course-media:" + p.path },
        });
        await store.audit("remove_media", "course-media", p.path);
      });
      return result(true);
    }
    if (key === "media-upload" && method === "POST") {
      const p = z
        .object({
          bucket: z.enum(["speaking", "course-media"]),
          type: z.string(),
          size: z.number().int().min(1).max(26214400),
        })
        .parse(await input(req));
      if (p.bucket === "course-media") teacher();
      const mimes: Record<string, string> = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/wav": "wav",
        "audio/mpeg": "mp3",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
        "video/mp4": "mp4",
      };
      if (
        !mimes[p.type] ||
        (p.bucket === "speaking" &&
          !["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"].includes(
            p.type,
          ))
      )
        throw new ApiError(400, "invalid_file");
      const path = `${user.id}/${crypto.randomUUID()}.${mimes[p.type]}`;
      const issued = checked(
        await db.storage.from(p.bucket).createSignedUploadUrl(path),
      );
      if (!issued) throw new ApiError(409, "operation_rejected");
      return result({ path, signedUrl: issued.signedUrl });
    }
    if (key === "media-finalize" && method === "POST") {
      const p = z
        .object({
          bucket: z.enum(["speaking", "course-media"]),
          path: z.string().max(1000),
          name: z.string().max(255).optional(),
        })
        .parse(await input(req));
      if (p.bucket === "course-media") teacher();
      if (p.path.split("/")[0] !== user.id)
        throw new ApiError(403, "forbidden");
      const file = checked(await db.storage.from(p.bucket).download(p.path));
      if (!file) throw new ApiError(404, "not_found");
      const type = file.type.split(";")[0];
      if (
        file.size < 1 ||
        file.size > 26214400 ||
        !matchesFileType(
          type,
          new Uint8Array(await file.slice(0, 16).arrayBuffer()),
        )
      )
        throw new ApiError(400, "invalid_file");
      checked(
        await serviceDb()
          .from("media_assets")
          .upsert(
            {
              user_id: user.id,
              bucket: p.bucket,
              storage_path: p.path,
              mime_type: type,
              original_name: p.name || null,
              size_bytes: file.size,
            },
            { onConflict: "storage_path" },
          ),
      );
      return result({ path: p.path });
    }
    if (key === "media" && method === "POST") {
      const form = await req.formData(),
        file = form.get("file"),
        bucket = z.enum(["speaking", "course-media"]).parse(form.get("bucket"));
      if (bucket === "course-media") teacher();
      if (!(file instanceof File) || file.size < 1 || file.size > 26214400)
        throw new ApiError(400, "invalid_file");
      const mimes: Record<string, string> = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/wav": "wav",
        "audio/mpeg": "mp3",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
        "video/mp4": "mp4",
      };
      const type = file.type.split(";")[0];
      if (
        !mimes[type] ||
        (bucket === "speaking" &&
          !["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"].includes(type))
      )
        throw new ApiError(400, "invalid_file");
      if (
        !matchesFileType(
          type,
          new Uint8Array(await file.slice(0, 16).arrayBuffer()),
        )
      )
        throw new ApiError(400, "invalid_file");
      const path = `${user.id}/${crypto.randomUUID()}.${mimes[type]}`;
      checked(
        await db.storage
          .from(bucket)
          .upload(path, file, { contentType: type, upsert: false }),
      );
      // Storage policy is authoritative. Only service records metadata after successful upload.
      checked(
        await serviceDb().from("media_assets").insert({
          user_id: user.id,
          bucket,
          storage_path: path,
          mime_type: type,
          size_bytes: file.size,
        }),
      );
      return result({ path });
    }
    if (key === "media-url" && method === "POST") {
      const p = z
        .object({
          bucket: z.enum(["speaking", "course-media"]),
          path: z.string().max(1000),
        })
        .parse(await input(req));
      return result(
        checked(await db.storage.from(p.bucket).createSignedUrl(p.path, 300)),
      );
    }
    if (path[0] === "teacher") {
      teacher();
      if (key === "teacher/progress" && method === "GET")
        return result(
          checked(
            await db
              .from("profiles")
              .select(
                "id,display_name,lesson_progress(lesson_id,completed_at),test_attempts(id,status,raw_score,total_points,band)",
              )
              .neq("id", user.id)
              .limit(100),
          ),
        );
      if (key === "teacher/students" && method === "GET")
        return result(
          checked(
            await db
              .from("profiles")
              .select("id,display_name")
              .neq("id", user.id)
              .limit(100),
          ),
        );
      if (key === "teacher/assignments" && method === "GET")
        return result(
          checked(
            await db
              .from("assignments")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(100),
          ),
        );
      if (key === "teacher/assignments" && method === "POST") {
        const p = z
          .object({
            student_id: uuid,
            title: z.string().min(1).max(200),
            lesson_id: uuid.nullable().optional(),
            test_id: uuid.nullable().optional(),
            writing_task_id: uuid.nullable().optional(),
            speaking_task_id: uuid.nullable().optional(),
            due_date: z.iso.date().nullable().optional(),
          })
          .strict()
          .parse(await input(req));
        return result(
          checked(
            await db
              .from("assignments")
              .insert({ ...p, teacher_id: user.id })
              .select()
              .single(),
          ),
        );
      }
    }
    if (path[0] === "admin") {
      if (path[1] === "content") teacher();
      else admin();
      if (key === "admin/stats" && method === "GET")
        return result(checked(await db.rpc("admin_statistics")));
      if (key === "admin/users" && method === "GET")
        return result(
          checked(
            await db
              .from("profiles")
              .select("*,user_roles(role)")
              .range(pageOffset * 100, pageOffset * 100 + 99),
          ),
        );
      if (key === "admin/roles" && method === "POST") {
        const p = z
          .object({
            user_id: uuid,
            role: z.enum(["STUDENT", "TEACHER", "ADMIN"]),
            remove: z.boolean().default(false),
          })
          .parse(await input(req));
        return result(
          checked(
            await db.rpc("change_role", {
              u: p.user_id,
              r: p.role,
              remove_role: p.remove,
            }),
          ),
        );
      }
      if (key === "admin/assign-teacher" && method === "POST") {
        const p = z
          .object({ teacher_id: uuid, student_id: uuid })
          .parse(await input(req));
        const role = await serviceDb()
          .from("user_roles")
          .select("role")
          .eq("user_id", p.teacher_id)
          .eq("role", "TEACHER")
          .maybeSingle();
        if (!role.data) throw new ApiError(400, "invalid_input");
        return result(
          checked(
            await db
              .from("teacher_student_assignments")
              .upsert(p, { onConflict: "teacher_id,student_id" })
              .select()
              .single(),
          ),
        );
      }
      if (key === "admin/settings") {
        if (method === "GET")
          return result(
            checked(await db.from("platform_settings").select("*").single()),
          );
        if (method === "PATCH") {
          const p = z
            .object({
              ai_enabled: z.boolean(),
              ai_daily_user_limit: z.number().int().min(0).max(100),
              ai_daily_platform_limit: z.number().int().min(0).max(10000),
            })
            .parse(await input(req));
          return result(
            checked(
              await db
                .from("platform_settings")
                .update(p)
                .eq("id", true)
                .select()
                .single(),
            ),
          );
        }
      }
      if (key === "admin/audit" && method === "GET")
        return result(
          checked(
            await db
              .from("audit_logs")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(100),
          ),
        );
      if (path[1] === "content") {
        const table = path[2] as keyof typeof contentSchemas;
        const schema = contentSchemas[table];
        if (!schema) throw new ApiError(404, "not_found");
        const idColumn = table === "answer_keys" ? "question_id" : "id";
        if (method === "GET" && !roles.includes("ADMIN")) {
          const store = new Store(prisma, user.id);
          const owned = [];
          for (const row of await store.all(table))
            if (await store.editor(table, row)) owned.push(row);
          return result(owned.slice(pageOffset * 100, pageOffset * 100 + 100));
        }
        if (method === "GET")
          return result(
            checked(
              await db
                .from(table)
                .select("*")
                .range(pageOffset * 100, pageOffset * 100 + 99),
            ),
          );
        if (method === "POST" && path[4] === "duplicate")
          return result(
            await prisma.$transaction(
              async (tx) => {
                const store = new Store(tx, user.id);
                const root = await store.get(table, uuid.parse(path[3]));
                if (
                  !root ||
                  !(await store.visible(table, root)) ||
                  (!(await store.admin()) && !(await store.editor(table, root)))
                )
                  throw new ApiError(403, "forbidden");
                const links: Record<string, [string, string][]> = {
                  tests: [["test_sections", "test_id"]],
                  test_sections: [
                    ["passages", "section_id"],
                    ["questions", "section_id"],
                  ],
                  questions: [
                    ["question_options", "question_id"],
                    ["answer_keys", "question_id"],
                  ],
                  courses: [["course_modules", "course_id"]],
                  course_modules: [["lessons", "module_id"]],
                  lessons: [["lesson_resources", "lesson_id"]],
                  mock_exams: [["mock_exam_sections", "mock_exam_id"]],
                };
                async function copy(
                  kind: string,
                  row: Record<string, unknown>,
                  override: Record<string, unknown> = {},
                ): Promise<Record<string, unknown>> {
                  const data = { ...row, ...override };
                  delete data.id;
                  delete data.created_at;
                  delete data.updated_at;
                  delete data.creator_id;
                  if ("status" in data) data.status = "draft";
                  const result = await store.mutate(kind, "insert", data);
                  for (const [child, fk] of links[kind] || [])
                    for (const r of (await store.all(child)).filter(
                      (x) => x[fk] === row.id,
                    ))
                      await copy(child, r, { [fk]: result.id });
                  return result;
                }
                return copy(table, root, {
                  title: String(root.title || "Content") + " (copy)",
                });
              },
              { timeout: 15000 },
            ),
          );
        if (method === "POST")
          return result(
            checked(
              await db
                .from(table)
                .insert(
                  schema.parse(await input(req)) as Record<string, unknown>,
                )
                .select()
                .single(),
            ),
          );
        const id = uuid.parse(path[3]);
        if (method === "PATCH") {
          const raw = await input(req);
          const parsed = schema.partial().parse(raw);
          const patch = Object.fromEntries(
            Object.entries(parsed).filter(([key]) =>
              Object.prototype.hasOwnProperty.call(raw, key),
            ),
          );
          return result(
            checked(
              await db
                .from(table)
                .update(patch)
                .eq(idColumn, id)
                .select()
                .single(),
            ),
          );
        }
        if (method === "DELETE")
          return result(
            checked(
              await db.from(table).delete().eq(idColumn, id).select(idColumn),
            ),
          );
      }
    }
    throw new ApiError(404, "not_found");
  } catch (error) {
    const status =
      error instanceof ApiError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : 500;
    const code =
      error instanceof ApiError
        ? error.code
        : status === 400
          ? "invalid_input"
          : "server_error";
    return Response.json(
      { error: code },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
