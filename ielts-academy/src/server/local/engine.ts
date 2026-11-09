/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./database";
import { onboardingSchema, contentSchemas } from "../validation";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export type Row = Record<string, any>;
export class Store {
  constructor(
    public db: Prisma.TransactionClient = prisma,
    public uid: string | null = null,
    public privileged = false,
  ) {}
  async all(kind: string): Promise<Row[]> {
    return (await this.db.entity.findMany({ where: { kind } })).map(
      (x) => x.data as Row,
    );
  }
  async get(kind: string, id: string): Promise<Row | undefined> {
    return (
      await this.db.entity.findUnique({ where: { kind_id: { kind, id } } })
    )?.data as Row | undefined;
  }
  async put(kind: string, data: Row) {
    const id = String(data.id ?? data.question_id ?? data.user_id);
    const row = {
      ...data,
      id: data.id ?? id,
      updated_at: new Date().toISOString(),
    };
    await this.db.entity.upsert({
      where: { kind_id: { kind, id } },
      create: { kind, id, data: row as Prisma.InputJsonValue },
      update: { data: row as Prisma.InputJsonValue },
    });
    return row;
  }
  async add(kind: string, data: Row) {
    return this.put(kind, {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...data,
    });
  }
  async roles(uid = this.uid) {
    return (await this.all("user_roles"))
      .filter((x) => x.user_id === uid)
      .map((x) => x.role);
  }
  async admin() {
    return this.privileged || (await this.roles()).includes("ADMIN");
  }
  async review(uid: string) {
    return (
      (await this.admin()) ||
      ((await this.roles()).includes("TEACHER") &&
        (await this.all("teacher_student_assignments")).some(
          (x) => x.teacher_id === this.uid && x.student_id === uid,
        ))
    );
  }
  async requireAdmin() {
    if (!(await this.admin())) throw new ApiError(403, "forbidden");
  }
  async own(kind: string, id: string) {
    const r = await this.get(kind, id);
    if (!r || r.user_id !== this.uid) throw new ApiError(403, "forbidden");
    return r;
  }
  async visible(kind: string, r: Row): Promise<boolean> {
    if (await this.admin()) return true;
    if (!this.uid) return false;
    if (kind === "profiles")
      return r.id === this.uid || (await this.review(r.id));
    if (kind === "user_roles") return r.user_id === this.uid;
    if (
      [
        "courses",
        "tests",
        "writing_tasks",
        "speaking_tasks",
        "mock_exams",
      ].includes(kind)
    )
      return r.status === "published";
    if (kind === "course_modules") return this.parent("courses", r.course_id);
    if (kind === "lessons")
      return (
        r.status === "published" &&
        (await this.parent("course_modules", r.module_id))
      );
    if (kind === "lesson_resources") return this.parent("lessons", r.lesson_id);
    if (kind === "test_sections") return this.parent("tests", r.test_id);
    if (["questions", "passages"].includes(kind))
      return this.parent("test_sections", r.section_id);
    if (kind === "question_options")
      return this.parent("questions", r.question_id);
    if (kind === "mock_exam_sections")
      return this.parent("mock_exams", r.mock_exam_id);
    if (
      kind === "answer_keys" ||
      kind === "platform_settings" ||
      kind === "audit_logs" ||
      kind === "content_publications"
    )
      return false;
    if (kind === "teacher_student_assignments")
      return r.teacher_id === this.uid || r.student_id === this.uid;
    if (kind === "assignments")
      return r.student_id === this.uid || r.teacher_id === this.uid;
    if (kind === "achievements") return true;
    const parents: Record<string, [string, string]> = {
      student_answers: ["test_attempts", "attempt_id"],
      writing_evaluations: ["writing_submissions", "submission_id"],
      speaking_evaluations: ["speaking_recordings", "recording_id"],
      speaking_transcripts: ["speaking_recordings", "recording_id"],
      mock_exam_results: ["mock_exam_attempts", "attempt_id"],
    };
    if (parents[kind])
      return this.parent(parents[kind][0], r[parents[kind][1]]);
    if (r.user_id)
      return (
        r.user_id === this.uid ||
        (!["user_preferences", "media_assets"].includes(kind) &&
          (await this.review(r.user_id)))
      );
    return false;
  }
  async parent(kind: string, id: string) {
    const row = await this.get(kind, id);
    return !!row && (await this.visible(kind, row));
  }
  async published(kind: string, id: string) {
    const row = await this.get(kind, id);
    if (!row || !(await this.visible(kind, row)) || row.status !== "published")
      throw new ApiError(409, "operation_rejected");
    return row;
  }
  async activity(kind: string, id: string) {
    const activityId = `${this.uid}:${kind}:${id}`;
    if (await this.get("learning_activity_events", activityId)) return;
    await this.put("learning_activity_events", {
      id: activityId,
      user_id: this.uid,
      kind,
      source_id: id,
      created_at: new Date().toISOString(),
    });
  }
  async audit(action: string, entity: string, id: string) {
    await this.add("audit_logs", {
      actor_id: this.uid,
      action,
      entity,
      entity_id: id,
    });
  }
  async mutate(kind: string, mode: string, input: Row, existing?: Row) {
    if (!this.privileged) {
      if (["profiles", "user_preferences"].includes(kind)) {
        if ((existing?.user_id ?? existing?.id) !== this.uid)
          throw new ApiError(403, "forbidden");
      } else if (kind === "assignments") {
        if (
          !(await this.review(input.student_id ?? existing?.student_id)) ||
          input.teacher_id !== this.uid
        )
          throw new ApiError(403, "forbidden");
      } else await this.requireAdmin();
    }
    const row = { ...existing, ...input };
    if (kind in contentSchemas) {
      const schema = contentSchemas[kind as keyof typeof contentSchemas];
      schema.parse(row);
      const refs: Record<string, string> = {
        course_id: "courses",
        module_id: "course_modules",
        lesson_id: "lessons",
        test_id: "tests",
        section_id: "test_sections",
        question_id: "questions",
        mock_exam_id: "mock_exams",
        writing_task_id: "writing_tasks",
        speaking_task_id: "speaking_tasks",
      };
      for (const [field, target] of Object.entries(refs))
        if (row[field] && !(await this.get(target, row[field])))
          throw new ApiError(409, "operation_rejected");
      const testFor = async (value: Row) => {
        if (kind === "tests") return value.id;
        if (kind === "test_sections") return value.test_id;
        if (["questions", "passages"].includes(kind))
          return (await this.get("test_sections", value.section_id))?.test_id;
        if (["answer_keys", "question_options"].includes(kind)) {
          const q = await this.get("questions", value.question_id);
          return q && (await this.get("test_sections", q.section_id))?.test_id;
        }
      };
      const testIds = [
        await testFor(row),
        existing && (await testFor(existing)),
      ].filter(Boolean);
      const usedObjective =
        testIds.length &&
        (await this.all("test_attempts")).some((a) =>
          testIds.includes(a.test_id),
        );
      const usedSubjective =
        (kind === "writing_tasks" &&
          (await this.all("writing_submissions")).some(
            (a) => a.task_id === row.id,
          )) ||
        (kind === "speaking_tasks" &&
          (await this.all("speaking_recordings")).some(
            (a) => a.task_id === row.id,
          ));
      const mockIds =
        kind === "mock_exams"
          ? [row.id]
          : kind === "mock_exam_sections"
            ? [row.mock_exam_id, existing?.mock_exam_id]
            : [];
      const usedMock =
        mockIds.length &&
        (await this.all("mock_exam_attempts")).some((a) =>
          mockIds.includes(a.mock_exam_id),
        );
      if (usedObjective || usedSubjective || usedMock) {
        if (
          mode === "delete" ||
          !["tests", "writing_tasks", "speaking_tasks", "mock_exams"].includes(
            kind,
          ) ||
          Object.keys(input).some(
            (k) =>
              k !== "status" &&
              JSON.stringify(input[k]) !== JSON.stringify(existing?.[k]),
          )
        )
          throw new ApiError(409, "operation_rejected");
      }
      if (
        kind === "answer_keys" &&
        (await this.all(kind)).some(
          (x) => x.question_id === row.question_id && x.id !== existing?.id,
        )
      )
        throw new ApiError(409, "operation_rejected");
      if (kind === "mock_exam_sections") {
        const targets = [
          row.test_id,
          row.writing_task_id,
          row.speaking_task_id,
        ].filter(Boolean);
        if (targets.length !== 1) throw new ApiError(409, "operation_rejected");
        if (row.test_id) {
          const test = await this.get("tests", row.test_id);
          if (test?.skill !== row.skill)
            throw new ApiError(409, "operation_rejected");
        } else if (
          row.writing_task_id
            ? row.skill !== "writing"
            : row.skill !== "speaking"
        )
          throw new ApiError(409, "operation_rejected");
        if (
          (await this.all(kind)).some(
            (x) =>
              x.mock_exam_id === row.mock_exam_id &&
              x.position === row.position &&
              x.id !== existing?.id,
          )
        )
          throw new ApiError(409, "operation_rejected");
      }
      if (kind === "tests" && row.status === "published") {
        const sections = (await this.all("test_sections"))
          .filter((x) => x.test_id === row.id)
          .map((x) => x.id);
        const questions = (await this.all("questions")).filter((x) =>
          sections.includes(x.section_id),
        );
        if (!questions.length) throw new ApiError(409, "operation_rejected");
        for (const q of questions)
          if (
            !(await this.all("answer_keys")).some((x) => x.question_id === q.id)
          )
            throw new ApiError(409, "operation_rejected");
      }
      if (kind === "mock_exams" && row.status === "published") {
        const sections = (await this.all("mock_exam_sections")).filter(
          (x) => x.mock_exam_id === row.id,
        );
        if (new Set(sections.map((x) => x.skill)).size !== 4)
          throw new ApiError(409, "operation_rejected");
        for (const x of sections)
          await this.published(
            x.test_id
              ? "tests"
              : x.writing_task_id
                ? "writing_tasks"
                : "speaking_tasks",
            x.test_id || x.writing_task_id || x.speaking_task_id,
          );
      }
    }
    if (kind === "assignments") {
      const targets = [
        ["lesson_id", "lessons"],
        ["test_id", "tests"],
        ["writing_task_id", "writing_tasks"],
        ["speaking_task_id", "speaking_tasks"],
      ].filter(([key]) => row[key]);
      if (targets.length !== 1) throw new ApiError(409, "operation_rejected");
      await this.published(targets[0][1], row[targets[0][0]]);
    }
    if (kind === "teacher_student_assignments") {
      if (
        !(await this.get("profiles", row.student_id)) ||
        !(await this.roles(row.teacher_id)).includes("TEACHER")
      )
        throw new ApiError(409, "operation_rejected");
    }
    if (mode === "delete") {
      // Restrict deletes with references instead of orphaning history.
      for (const x of await this.db.entity.findMany())
        if (
          x.id !== row.id &&
          Object.entries(x.data as Row).some(
            ([k, v]) => k.endsWith("_id") && v === row.id,
          )
        )
          throw new ApiError(409, "operation_rejected");
      await this.db.entity.delete({
        where: { kind_id: { kind, id: existing!.id } },
      });
      return row;
    }
    const result = existing
      ? await this.put(kind, row)
      : await this.add(kind, row);
    await this.audit(mode, kind, result.id);
    return result;
  }
  async rpc(name: string, p: Row): Promise<any> {
    const now = new Date().toISOString();
    if (name === "consume_rate_limit") {
      const old = await this.db.rateLimit.findUnique({ where: { key: p.k } });
      const fresh =
        !old || Date.now() - old.start.getTime() > p.window_seconds * 1000;
      const r = await this.db.rateLimit.upsert({
        where: { key: p.k },
        create: { key: p.k, start: new Date(), hits: 1 },
        update: {
          hits: fresh ? 1 : (old?.hits || 0) + 1,
          ...(fresh ? { start: new Date() } : {}),
        },
      });
      return r.hits <= p.max_hits;
    }
    if (!this.uid && !this.privileged) throw new ApiError(401, "unauthorized");
    if (name === "save_onboarding") {
      const old = await this.get("student_onboarding", this.uid!);
      const row = {
        ...old,
        ...onboardingSchema.parse(p.p),
        id: this.uid,
        user_id: this.uid,
        completed: old?.completed || p.finish,
        completed_at: old?.completed_at || (p.finish ? now : null),
      };
      if (row.completed) {
        const required = [
          "motivation",
          "target_band",
          "current_level",
          "priority_skills",
          "daily_goal_minutes",
          "weekly_availability",
        ];
        if (required.some((k) => !row[k as keyof typeof row]))
          throw new ApiError(400, "invalid_input");
        await this.put("student_achievements", {
          id: this.uid,
          user_id: this.uid,
          achievement_id: "onboarding_complete",
          awarded_at: now,
        });
        await this.activity("onboarding", this.uid!);
      }
      return this.put("student_onboarding", row);
    }
    if (name === "start_test") {
      const test = await this.published("tests", p.t);
      const old = (await this.all("test_attempts")).find(
        (x) =>
          x.user_id === this.uid &&
          x.test_id === p.t &&
          x.status === "in_progress",
      );
      return (
        old ||
        this.add("test_attempts", {
          user_id: this.uid,
          test_id: p.t,
          started_at: now,
          deadline: new Date(
            Date.now() + test.duration_seconds * 1000,
          ).toISOString(),
          status: "in_progress",
          raw_score: null,
          total_points: null,
          band: null,
        })
      );
    }
    if (name === "save_answers" || name === "submit_test") {
      const a = await this.own("test_attempts", p.a);
      if (name === "submit_test" && a.status === "submitted") return a;
      if (
        a.status !== "in_progress" ||
        (name === "save_answers" && Date.parse(a.deadline) < Date.now())
      )
        throw new ApiError(409, "operation_rejected");
      const sections = (await this.all("test_sections"))
        .filter((x) => x.test_id === a.test_id)
        .map((x) => x.id);
      const questions = (await this.all("questions")).filter((x) =>
        sections.includes(x.section_id),
      );
      if (name === "save_answers") {
        for (const [id, answer] of Object.entries(p.p)) {
          if (!questions.some((x) => x.id === id))
            throw new ApiError(403, "forbidden");
          await this.put("student_answers", {
            id: `${p.a}:${id}`,
            attempt_id: p.a,
            question_id: id,
            answer,
          });
        }
        return null;
      }
      const answers = (await this.all("student_answers")).filter(
        (x) => x.attempt_id === p.a,
      );
      const keys = await this.all("answer_keys");
      let raw = 0,
        total = 0;
      const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
      for (const q of questions) {
        total += q.points;
        const value = answers.find((x) => x.question_id === q.id)?.answer || "";
        const key = keys.find((x) => x.question_id === q.id);
        if (
          key?.accepted.some((v: string) => norm(v) === norm(value)) &&
          (!q.max_words || value.trim().split(/\s+/).length <= q.max_words)
        )
          raw += q.points;
      }
      const test = await this.get("tests", a.test_id);
      const bands = (test?.band_thresholds || [])
        .filter((x: Row) => raw >= x.min)
        .map((x: Row) => x.band);
      await this.activity("test", a.id);
      return this.put("test_attempts", {
        ...a,
        status: "submitted",
        submitted_at: now,
        raw_score: raw,
        total_points: total,
        band: bands.length ? Math.max(...bands) : null,
      });
    }
    if (name === "writing_draft") {
      let row = p.submission
        ? await this.own("writing_submissions", p.submission)
        : (await this.all("writing_submissions")).find(
            (x) =>
              x.user_id === this.uid && x.task_id === p.t && !x.submitted_at,
          );
      if (row && row.task_id !== p.t) throw new ApiError(403, "forbidden");
      if (row?.submitted_at) return row;
      if (!row) {
        const task = await this.published("writing_tasks", p.t);
        row = await this.add("writing_submissions", {
          user_id: this.uid,
          task_id: p.t,
          body: "",
          deadline: new Date(
            Date.now() + task.duration_seconds * 1000,
          ).toISOString(),
          submitted_at: null,
        });
      }
      if (p.body_text !== null && Date.parse(row.deadline) >= Date.now())
        row.body = p.body_text;
      if (p.finish) {
        if (!row.body.trim()) throw new ApiError(400, "invalid_input");
        row.submitted_at = now;
        await this.activity("writing", row.id);
      }
      row.word_count = row.body.trim()
        ? row.body.trim().split(/\s+/).length
        : 0;
      return this.put("writing_submissions", row);
    }
    if (name === "enroll_course") {
      await this.published("courses", p.c);
      if (!(await this.get("course_enrollments", `${this.uid}:${p.c}`)))
        await this.put("course_enrollments", {
          id: `${this.uid}:${p.c}`,
          user_id: this.uid,
          course_id: p.c,
          created_at: now,
        });
      return null;
    }
    if (name === "complete_lesson") {
      const l = await this.published("lessons", p.l);
      const m = await this.get("course_modules", l.module_id);
      if (
        !(await this.get("course_enrollments", `${this.uid}:${m?.course_id}`))
      )
        throw new ApiError(403, "forbidden");
      await this.activity("lesson", p.l);
      if (!(await this.get("lesson_progress", `${this.uid}:${p.l}`)))
        await this.put("lesson_progress", {
          id: `${this.uid}:${p.l}`,
          user_id: this.uid,
          lesson_id: p.l,
          completed_at: now,
        });
      return null;
    }
    if (name === "add_recording") {
      await this.published("speaking_tasks", p.t);
      if (
        !(await this.all("media_assets")).some(
          (x) =>
            x.user_id === this.uid &&
            x.storage_path === p.p &&
            x.bucket === "speaking",
        )
      )
        throw new ApiError(403, "forbidden");
      const old = (await this.all("speaking_recordings")).find(
        (x) => x.storage_path === p.p,
      );
      if (old) return old;
      const r = await this.add("speaking_recordings", {
        user_id: this.uid,
        task_id: p.t,
        storage_path: p.p,
      });
      await this.activity("speaking", r.id);
      return r;
    }
    if (name === "review_submission") {
      const kind =
        p.k === "writing" ? "writing_submissions" : "speaking_recordings";
      const r = await this.get(kind, p.s);
      if (
        !r ||
        !(await this.review(r.user_id)) ||
        (p.k === "writing" && !r.submitted_at)
      )
        throw new ApiError(403, "forbidden");
      await this.add(p.k + "_evaluations", {
        [p.k === "writing" ? "submission_id" : "recording_id"]: p.s,
        evaluator_id: this.uid,
        source: "teacher",
        band: p.b,
        criteria: p.c,
        feedback: p.f,
      });
      await this.audit("evaluate", p.k, p.s);
      return null;
    }
    if (name === "change_role") {
      await this.requireAdmin();
      if (
        !(await this.get("profiles", p.u)) ||
        !["ADMIN", "TEACHER", "STUDENT"].includes(p.r)
      )
        throw new ApiError(400, "invalid_input");
      const id = `${p.u}:${p.r}`;
      if (p.remove_role) {
        if (
          p.r === "STUDENT" ||
          (p.r === "ADMIN" &&
            (await this.all("user_roles")).filter((x) => x.role === "ADMIN")
              .length <= 1)
        )
          throw new ApiError(409, "operation_rejected");
        await this.db.entity.deleteMany({ where: { kind: "user_roles", id } });
      } else await this.put("user_roles", { id, user_id: p.u, role: p.r });
      await this.audit("change_role", "user_roles", id);
      return null;
    }
    if (name === "reserve_ai") {
      const pref = await this.get("user_preferences", this.uid!);
      const cfg = await this.get("platform_settings", "true");
      const sub = await this.own(
        p.k === "writing" ? "writing_submissions" : "speaking_recordings",
        p.s,
      );
      if (
        !pref?.ai_consent ||
        !cfg?.ai_enabled ||
        (p.k === "writing" && !sub.submitted_at)
      )
        throw new ApiError(403, "forbidden");
      const logs = (await this.all("ai_usage_logs")).filter(
        (x) => x.created_at >= now.slice(0, 10),
      );
      if (
        logs.length >= cfg.ai_daily_platform_limit ||
        logs.filter((x) => x.user_id === this.uid).length >=
          cfg.ai_daily_user_limit
      )
        throw new ApiError(429, "rate_limited");
      return (
        await this.add("ai_usage_logs", {
          user_id: this.uid,
          source_id: p.s,
          kind: p.k,
          model: p.m,
          status: "reserved",
        })
      ).id;
    }
    if (name === "admin_statistics") {
      await this.requireAdmin();
      const roles = await this.all("user_roles"),
        attempts = (await this.all("test_attempts")).filter(
          (x) => x.status === "submitted",
        );
      const bands = attempts.filter((x) => x.band !== null);
      return {
        users: (await this.all("profiles")).length,
        students: roles.filter((x) => x.role === "STUDENT").length,
        teachers: roles.filter((x) => x.role === "TEACHER").length,
        published_tests: (await this.all("tests")).filter(
          (x) => x.status === "published",
        ).length,
        published_mocks: (await this.all("mock_exams")).filter(
          (x) => x.status === "published",
        ).length,
        published_lessons: (await this.all("lessons")).filter(
          (x) => x.status === "published",
        ).length,
        completed_attempts: attempts.length,
        average_band: bands.length
          ? bands.reduce((n, x) => n + x.band, 0) / bands.length
          : null,
      };
    }
    if (name === "start_mock") {
      const m = await this.published("mock_exams", p.m);
      if (
        (m.available_from && m.available_from > now) ||
        (m.available_until && m.available_until < now)
      )
        throw new ApiError(409, "operation_rejected");
      const old = (await this.all("mock_exam_attempts")).find(
        (x) =>
          x.user_id === this.uid && x.mock_exam_id === p.m && !x.submitted_at,
      );
      if (old && !m.allow_resume) throw new ApiError(409, "operation_rejected");
      return (
        old ||
        this.add("mock_exam_attempts", {
          user_id: this.uid,
          mock_exam_id: p.m,
          started_at: now,
          submitted_at: null,
        })
      );
    }
    if (name === "link_mock_section") {
      const a = await this.own("mock_exam_attempts", p.a),
        sections = (await this.all("mock_exam_sections")).filter(
          (x) => x.mock_exam_id === a.mock_exam_id,
        ),
        s = sections.find((x) => x.id === p.s),
        results = (await this.all("mock_exam_results")).filter(
          (x) => x.attempt_id === p.a,
        );
      if (
        !s ||
        a.submitted_at ||
        sections.some(
          (x) =>
            x.position < s.position &&
            !results.some((r) => r.section_id === x.id),
        )
      )
        throw new ApiError(409, "operation_rejected");
      const table = s.test_id
        ? "test_attempts"
        : s.writing_task_id
          ? "writing_submissions"
          : "speaking_recordings";
      const r = await this.own(table, p.r);
      if (
        (r.test_id || r.task_id) !==
          (s.test_id || s.writing_task_id || s.speaking_task_id) ||
        (r.started_at || r.created_at) < a.started_at ||
        (table !== "speaking_recordings" && !r.submitted_at)
      )
        throw new ApiError(409, "operation_rejected");
      if (!results.some((x) => x.section_id === p.s))
        await this.put("mock_exam_results", {
          id: `${p.a}:${p.s}`,
          attempt_id: p.a,
          section_id: p.s,
          [s.test_id
            ? "test_attempt_id"
            : s.writing_task_id
              ? "writing_submission_id"
              : "speaking_recording_id"]: p.r,
        });
      if (
        (await this.all("mock_exam_results")).filter(
          (x) => x.attempt_id === p.a,
        ).length === sections.length
      )
        await this.put("mock_exam_attempts", { ...a, submitted_at: now });
      return null;
    }
    if (name === "mock_scorecard") {
      const a = await this.get("mock_exam_attempts", p.a);
      if (!a || !(await this.visible("mock_exam_attempts", a)))
        throw new ApiError(403, "forbidden");
      const groups: Record<string, (number | null)[]> = {};
      for (const s of (await this.all("mock_exam_sections")).filter(
        (x) => x.mock_exam_id === a.mock_exam_id,
      )) {
        const r = (await this.all("mock_exam_results")).find(
          (x) => x.attempt_id === p.a && x.section_id === s.id,
        );
        let band = null;
        if (r?.test_attempt_id)
          band =
            (await this.get("test_attempts", r.test_attempt_id))?.band ?? null;
        else if (r) {
          const evaluations = (await this.all(s.skill + "_evaluations"))
            .filter(
              (x) =>
                (x.submission_id || x.recording_id) ===
                  (r.writing_submission_id || r.speaking_recording_id) &&
                (s.skill !== "speaking" || x.source === "teacher"),
            )
            .sort(
              (a, b) =>
                Number(b.source === "teacher") -
                  Number(a.source === "teacher") ||
                b.created_at.localeCompare(a.created_at),
            );
          band = evaluations[0]?.band ?? null;
        }
        const count =
          s.writing_task_id &&
          (await this.get("writing_tasks", s.writing_task_id))?.task_number ===
            2
            ? 2
            : 1;
        (groups[s.skill] ??= []).push(...Array(count).fill(band));
      }
      const sections = Object.entries(groups).map(([skill, bands]) => ({
        skill,
        band: bands.includes(null)
          ? null
          : Math.round(
              (bands.reduce<number>((a, b) => a + (b || 0), 0) / bands.length) *
                2,
            ) / 2,
      }));
      return {
        sections,
        overall_band:
          sections.length === 4 && sections.every((x) => x.band !== null)
            ? Math.round((sections.reduce((n, x) => n + x.band!, 0) / 4) * 2) /
              2
            : null,
        estimate: true,
      };
    }
    throw new ApiError(404, "not_found");
  }
}
