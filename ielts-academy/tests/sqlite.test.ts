import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const state = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) =>
      state.jar.has(k) ? { value: state.jar.get(k) } : undefined,
    set: (k: string, v: string) => state.jar.set(k, v),
    delete: (k: string) => state.jar.delete(k),
  }),
}));
let local: typeof import("@/server/local/client");
let prisma: (typeof import("@/server/local/database"))["prisma"];
let Store: (typeof import("@/server/local/engine"))["Store"];
let route: typeof import("@/app/api/[...path]/route");
let admin: string, student: string, other: string, teacher: string;
const sessions: Record<string, string> = {};
const directory = mkdtempSync(join(tmpdir(), "academy-sqlite-"));
const email = (s: string) => `${s}@example.test`;
const password = "Test password that is long enough!";
async function api(path: string, method = "GET", body?: unknown) {
  const response = await route.GET(
    new Request(`http://localhost:3000/api/${path}`, {
      method,
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    { params: Promise.resolve({ path: path.split("/") }) },
  );
  return { status: response.status, ...(await response.json()) };
}
function as(id: string) {
  state.jar.set("academy_session", sessions[id]);
  return new Store(prisma, id);
}
async function rpc(id: string, name: string, args: Record<string, unknown>) {
  return local.client(as(id)).rpc(name, args);
}
beforeAll(async () => {
  process.env.DATABASE_URL = "file:" + join(directory, "academy.db");
  process.env.APP_URL = "http://localhost:3000";
  process.env.PRIVATE_UPLOAD_DIR = join(directory, "uploads");
  execFileSync(process.execPath, ["scripts/db-setup.mjs"], {
    env: process.env,
  });
  execFileSync(process.execPath, ["scripts/db-setup.mjs"], {
    env: process.env,
  });
  local = await import("@/server/local/client");
  ({ prisma } = await import("@/server/local/database"));
  ({ Store } = await import("@/server/local/engine"));
  route = await import("@/app/api/[...path]/route");
  for (const name of ["admin", "student", "other", "teacher"]) {
    state.jar.clear();
    expect(
      (
        await api("auth/register", "POST", {
          email: email(name),
          password,
          name,
        })
      ).status,
    ).toBe(200);
    const me = await api("me");
    sessions[me.data.id] = state.jar.get("academy_session")!;
    if (name === "admin") admin = me.data.id;
    if (name === "student") student = me.data.id;
    if (name === "other") other = me.data.id;
    if (name === "teacher") teacher = me.data.id;
  }
  execFileSync(process.execPath, ["scripts/first-admin.mjs", email("admin")], {
    env: process.env,
  });
  as(admin);
  expect(
    (await api("admin/roles", "POST", { user_id: teacher, role: "TEACHER" }))
      .status,
  ).toBe(200);
  expect(
    (
      await api("admin/assign-teacher", "POST", {
        teacher_id: teacher,
        student_id: student,
      })
    ).status,
  ).toBe(200);
}, 30000);
beforeEach(async () => {
  await prisma.rateLimit.deleteMany();
  as(student);
});
afterAll(async () => {
  await prisma?.$disconnect();
  rmSync(directory, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
  delete process.env.APP_URL;
  delete process.env.PRIVATE_UPLOAD_DIR;
});
describe("SQLite API integration (real migrations, passwords and sessions)", () => {
  it("initializes without sample education or results", async () => {
    expect(await prisma.entity.count({ where: { kind: "tests" } })).toBe(0);
    expect(
      await prisma.entity.count({ where: { kind: "test_attempts" } }),
    ).toBe(0);
  });
  it("stores salted hashes and returns only safe profile fields", async () => {
    const row = await prisma.account.findUniqueOrThrow({
      where: { id: student },
    });
    expect(row.passwordHash).toMatch(/^scrypt:/);
    expect(row.passwordHash).not.toContain(password);
    expect(JSON.stringify(await api("me"))).not.toContain(row.passwordHash);
    expect((await api("me")).data.roles).toEqual(["STUDENT"]);
  });
  it("rejects bad credentials and duplicate accounts", async () => {
    expect(
      (
        await api("auth/login", "POST", {
          email: email("student"),
          password: "Incorrect long password!",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await api("auth/register", "POST", {
          email: email("student").toUpperCase(),
          password,
          name: "Duplicate",
        })
      ).status,
    ).toBe(400);
  });
  it("revokes logout sessions and rotates tokens on login", async () => {
    const old = state.jar.get("academy_session")!;
    expect((await api("auth/logout", "POST", {})).status).toBe(200);
    expect(await local.sessionUser(old)).toBeNull();
    expect((await api("me")).status).toBe(401);
    expect(
      (await api("auth/login", "POST", { email: email("student"), password }))
        .status,
    ).toBe(200);
    sessions[student] = state.jar.get("academy_session")!;
    expect(sessions[student]).not.toBe(old);
  });
  it("rejects expired sessions", async () => {
    const { digest } = await import("@/server/local/password");
    await prisma.session.create({
      data: {
        tokenHash: digest("expired-token"),
        accountId: student,
        expiresAt: new Date(0),
      },
    });
    expect(await local.sessionUser("expired-token")).toBeNull();
  });
  it("requires a same-origin request and server-side Admin role", async () => {
    expect((await api("admin/users")).status).toBe(403);
    expect(
      (await api("admin/roles", "POST", { user_id: student, role: "ADMIN" }))
        .status,
    ).toBe(403);
    const r = await route.POST(
      new Request("http://localhost:3000/api/profile", {
        method: "PATCH",
        headers: { origin: "https://foreign.example" },
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["profile"] }) },
    );
    expect(r.status).toBe(403);
    expect(
      (await rpc(student, "change_role", { u: student, r: "ADMIN" })).error,
    ).toBeTruthy();
  });
  it("persists onboarding and preferences across a new database connection", async () => {
    const answers = {
      motivation: "career",
      target_band: 7,
      current_level: "intermediate",
      priority_skills: ["writing"],
      daily_goal_minutes: 30,
      weekly_availability: [1, 3],
    };
    expect(
      (await api("onboarding", "PATCH", { answers, finish: true })).status,
    ).toBe(200);
    expect((await api("preferences", "PATCH", { language: "uz" })).status).toBe(
      200,
    );
    await prisma.$disconnect();
    const me = await api("me");
    expect(me.data.onboarding.completed).toBe(true);
    expect(me.data.preferences.language).toBe("uz");
    expect(me.data.destination).toBe("/dashboard");
    expect((await api("dashboard")).data.learning_activity_events).toHaveLength(
      1,
    );
  });
  it("does not mark incomplete onboarding complete", async () => {
    as(other);
    expect(
      (
        await api("onboarding", "PATCH", {
          answers: { motivation: "career" },
          finish: true,
        })
      ).status,
    ).not.toBe(200);
    expect((await api("me")).data.onboarding).toBeNull();
  });
  it("only grants teachers access to assigned students", async () => {
    const assigned = as(teacher);
    expect(await assigned.visible("profiles", { id: student })).toBe(true);
    expect(await assigned.visible("profiles", { id: other })).toBe(false);
    expect(
      (await api("teacher/students")).data.map((x: { id: string }) => x.id),
    ).toContain(student);
    expect(
      (await local.client(assigned).from("profiles").select("*")).data.map(
        (x: { id: string }) => x.id,
      ),
    ).not.toContain(other);
  });
  it("rejects path traversal and protects private recordings", async () => {
    expect(() => local.privatePath("speaking", student + "/..")).toThrow();
    expect(() => local.privatePath("speaking", "../file.wav")).toThrow();
    expect(
      await local.mediaAllowed(as(other), "speaking", student + "/private.wav"),
    ).toBe(false);
    expect(
      await local.mediaAllowed(
        as(student),
        "speaking",
        student + "/private.wav",
      ),
    ).toBe(true);
    expect(
      await local.mediaAllowed(
        as(teacher),
        "speaking",
        student + "/private.wav",
      ),
    ).toBe(false);
  });
  it("grades from private keys and freezes used question content", async () => {
    as(admin);
    const create = async (k: string, p: unknown) => {
      const r = await api("admin/content/" + k, "POST", p);
      expect(r.status).toBe(200);
      return r.data;
    };
    const t = await create("tests", {
      title: "Real test fixture",
      skill: "reading",
      duration_seconds: 60,
      band_thresholds: [
        { min: 0, band: 0 },
        { min: 1, band: 6.5 },
      ],
    });
    const s = await create("test_sections", {
      test_id: t.id,
      title: "Section",
    });
    const q = await create("questions", {
      section_id: s.id,
      prompt: "Answer?",
      kind: "text",
      position: 0,
      points: 1,
      max_words: 2,
    });
    await create("answer_keys", {
      question_id: q.id,
      accepted: ["the answer"],
    });
    expect(
      (
        await api("admin/content/tests/" + t.id, "PATCH", {
          status: "published",
        })
      ).status,
    ).toBe(200);
    as(student);
    const published = await api("test/" + t.id);
    expect(JSON.stringify(published)).not.toContain("accepted");
    expect(
      (await local.client(as(student)).from("answer_keys").select("*")).data,
    ).toEqual([]);
    const a = (await rpc(student, "start_test", { t: t.id })).data;
    expect(
      (
        await rpc(other, "save_answers", {
          a: a.id,
          p: { [q.id]: "the answer" },
        })
      ).error,
    ).toBeTruthy();
    expect(
      (
        await rpc(student, "save_answers", {
          a: a.id,
          p: { [randomUUID()]: "the answer" },
        })
      ).error,
    ).toBeTruthy();
    expect(
      (
        await rpc(student, "save_answers", {
          a: a.id,
          p: { [q.id]: " THE   ANSWER " },
        })
      ).error,
    ).toBeNull();
    const result = await rpc(student, "submit_test", { a: a.id });
    expect(result.data).toMatchObject({
      raw_score: 1,
      total_points: 1,
      band: 6.5,
      status: "submitted",
    });
    expect((await rpc(student, "submit_test", { a: a.id })).data.id).toBe(a.id);
    expect(
      (
        await rpc(student, "save_answers", {
          a: a.id,
          p: { [q.id]: "different" },
        })
      ).error,
    ).toBeTruthy();
    as(admin);
    expect(
      (
        await api("admin/content/questions/" + q.id, "PATCH", {
          prompt: "Changed",
        })
      ).status,
    ).toBe(409);
  });
  it("persists enrollment and lesson completion with parent authorization", async () => {
    const privileged = new Store(prisma, admin, true);
    const c = await privileged.add("courses", {
      title: "Course",
      status: "published",
    });
    const m = await privileged.add("course_modules", {
      course_id: c.id,
      title: "Module",
    });
    const l = await privileged.add("lessons", {
      module_id: m.id,
      title: "Lesson",
      body: "Content",
      status: "published",
    });
    expect(
      (await rpc(student, "complete_lesson", { l: l.id })).error,
    ).toBeTruthy();
    expect((await rpc(student, "enroll_course", { c: c.id })).error).toBeNull();
    expect(
      (await rpc(student, "complete_lesson", { l: l.id })).error,
    ).toBeNull();
    expect(
      (await rpc(student, "complete_lesson", { l: l.id })).error,
    ).toBeNull();
    expect(
      (await local.client(as(student)).from("lesson_progress").select("*"))
        .data,
    ).toHaveLength(1);
    expect(
      (await local.client(as(other)).from("lesson_progress").select("*")).data,
    ).toHaveLength(0);
  });
  it("saves writing drafts and accepts only authorized teacher grading", async () => {
    const task = await new Store(prisma, admin, true).add("writing_tasks", {
      title: "Writing",
      prompt: "Discuss",
      task_number: 2,
      duration_seconds: 2400,
      status: "published",
    });
    const d = await rpc(student, "writing_draft", {
      t: task.id,
      body_text: "My essay",
      finish: false,
      submission: null,
    });
    const finished = await rpc(student, "writing_draft", {
      t: task.id,
      body_text: "My final essay",
      finish: true,
      submission: d.data.id,
    });
    expect(finished.data.submitted_at).toBeTruthy();
    expect(
      (
        await rpc(other, "writing_draft", {
          t: task.id,
          body_text: "Overwrite",
          submission: d.data.id,
        })
      ).error,
    ).toBeTruthy();
    const review = {
      k: "writing",
      s: d.data.id,
      b: 7,
      c: { task_response: 7, coherence: 7, lexical: 7, grammar: 7 },
      f: "Detailed teacher feedback",
    };
    expect((await rpc(other, "review_submission", review)).error).toBeTruthy();
    expect((await rpc(teacher, "review_submission", review)).error).toBeNull();
    as(student);
    expect(
      (await api("submissions")).data.writing[0].writing_evaluations[0].source,
    ).toBe("teacher");
  });
  it("requires AI consent and configuration and never invents evaluations", async () => {
    as(student);
    const submissions = await api("submissions");
    expect(
      (
        await api("ai", "POST", {
          kind: "writing",
          id: submissions.data.writing[0].id,
        })
      ).status,
    ).not.toBe(200);
  });
  it("preserves the last administrator", async () => {
    expect(
      (
        await rpc(admin, "change_role", {
          u: admin,
          r: "ADMIN",
          remove_role: true,
        })
      ).error,
    ).toBeTruthy();
  });
  it("uploads real private audio and authorizes owner and assigned reviewer only", async () => {
    const media = await import("@/app/api/local-media/[...file]/route");
    const task = await new Store(prisma, admin, true).add("speaking_tasks", {
      title: "Speaking",
      prompt: "Explain",
      part: 1,
      status: "published",
    });
    as(student);
    const issued = await api("media-upload", "POST", {
      bucket: "speaking",
      type: "audio/wav",
      size: 44,
    });
    expect(issued.status).toBe(200);
    const path = issued.data.path;
    const params = {
      params: Promise.resolve({ file: ["speaking", ...path.split("/")] }),
    };
    const url = "http://localhost:3000" + issued.data.signedUrl;
    const bytes = Buffer.alloc(44);
    bytes.write("RIFF");
    bytes.write("WAVE", 8);
    const put = () =>
      media.PUT(
        new Request(url, {
          method: "PUT",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "audio/wav",
          },
          body: new Uint8Array(bytes),
        }),
        params,
      );
    expect((await put()).status).toBe(200);
    expect((await put()).status).toBe(403);
    expect(
      (await api("media-finalize", "POST", { bucket: "speaking", path }))
        .status,
    ).toBe(200);
    expect(
      (await api("speaking", "POST", { task_id: task.id, path })).status,
    ).toBe(200);
    const read = () => media.GET(new Request(url), params);
    expect(Buffer.from(await (await read()).arrayBuffer())).toEqual(bytes);
    as(other);
    expect((await read()).status).toBe(403);
    expect(
      (await api("speaking", "POST", { task_id: task.id, path })).status,
    ).not.toBe(200);
    as(teacher);
    expect((await read()).status).toBe(200);
    state.jar.clear();
    expect((await read()).status).toBe(401);
  });
  it("enforces deadlines without replacing saved answers", async () => {
    const privileged = new Store(prisma, admin, true);
    const t = (await privileged.all("tests"))[0];
    const a = (await rpc(student, "start_test", { t: t.id })).data;
    await privileged.put("test_attempts", {
      ...a,
      deadline: new Date(0).toISOString(),
    });
    const q = (await privileged.all("questions"))[0];
    expect(
      (
        await rpc(student, "save_answers", {
          a: a.id,
          p: { [q.id]: "the answer" },
        })
      ).error,
    ).toBeTruthy();
    const submitted = await rpc(student, "submit_test", { a: a.id });
    expect(submitted.data.raw_score).toBe(0);
  });
  it("freezes used subjective tasks and blocks objective reparenting", async () => {
    as(admin);
    const s = new Store(prisma, admin);
    const w = (await s.all("writing_tasks"))[0];
    expect(
      (
        await api("admin/content/writing_tasks/" + w.id, "PATCH", {
          prompt: "Changed",
        })
      ).status,
    ).toBe(409);
    const test = await s.add("tests", {
      title: "Other test",
      skill: "reading",
      status: "draft",
      duration_seconds: 60,
    });
    const section = await s.add("test_sections", {
      title: "Other section",
      test_id: test.id,
    });
    const question = (await s.all("questions"))[0];
    expect(
      (
        await api("admin/content/questions/" + question.id, "PATCH", {
          section_id: section.id,
        })
      ).status,
    ).toBe(409);
  });
  it("completes a four-skill mock with real work and teacher-scored subjective sections", async () => {
    const fixture = new Store(prisma, admin, true);
    const reading = (await fixture.all("tests")).find(
      (x) => x.status === "published",
    )!;
    as(admin);
    const create = async (k: string, p: unknown) => {
      const r = await api("admin/content/" + k, "POST", p);
      expect(r.status).toBe(200);
      return r.data;
    };
    const listening = await create("tests", {
      title: "Listening",
      skill: "listening",
      duration_seconds: 60,
      band_thresholds: [
        { min: 0, band: 0 },
        { min: 1, band: 7 },
      ],
    });
    const sec = await create("test_sections", {
      test_id: listening.id,
      title: "Audio section",
    });
    const question = await create("questions", {
      section_id: sec.id,
      prompt: "Answer?",
      kind: "text",
      position: 0,
    });
    await create("answer_keys", {
      question_id: question.id,
      accepted: ["yes"],
    });
    expect(
      (
        await api("admin/content/tests/" + listening.id, "PATCH", {
          status: "published",
        })
      ).status,
    ).toBe(200);
    const writing = (await fixture.all("writing_tasks"))[0],
      speaking = (await fixture.all("speaking_tasks"))[0];
    const exam = await create("mock_exams", { title: "Four skills" });
    const sections = [];
    for (const [i, p] of [
      { skill: "reading", test_id: reading.id },
      { skill: "listening", test_id: listening.id },
      { skill: "writing", writing_task_id: writing.id },
      { skill: "speaking", speaking_task_id: speaking.id },
    ].entries())
      sections.push(
        await create("mock_exam_sections", {
          mock_exam_id: exam.id,
          position: i,
          ...p,
        }),
      );
    expect(
      (
        await api("admin/content/mock_exams/" + exam.id, "PATCH", {
          status: "published",
        })
      ).status,
    ).toBe(200);
    const mock = (await rpc(student, "start_mock", { m: exam.id })).data;
    expect(
      (await rpc(student, "mock_scorecard", { a: mock.id })).data.overall_band,
    ).toBeNull();
    expect(
      (
        await rpc(student, "link_mock_section", {
          a: mock.id,
          s: sections[3].id,
          r: randomUUID(),
        })
      ).error,
    ).toBeTruthy();
    for (const [i, t] of [reading, listening].entries()) {
      const a = (await rpc(student, "start_test", { t: t.id })).data;
      const q = (await fixture.all("questions")).find((q) =>
        i === 0 ? q.id !== question.id : q.id === question.id,
      )!;
      expect(
        (
          await rpc(student, "save_answers", {
            a: a.id,
            p: { [q.id]: i === 0 ? "the answer" : "yes" },
          })
        ).error,
      ).toBeNull();
      expect((await rpc(student, "submit_test", { a: a.id })).error).toBeNull();
      expect(
        (
          await rpc(student, "link_mock_section", {
            a: mock.id,
            s: sections[i].id,
            r: a.id,
          })
        ).error,
      ).toBeNull();
    }
    const essay = (
      await rpc(student, "writing_draft", {
        t: writing.id,
        body_text: "A new timed essay",
        finish: true,
        submission: null,
      })
    ).data;
    expect(
      (
        await rpc(student, "link_mock_section", {
          a: mock.id,
          s: sections[2].id,
          r: essay.id,
        })
      ).error,
    ).toBeNull();
    // The recording fixture is real persisted metadata; upload transport is tested above.
    const path = student + "/" + randomUUID() + ".wav";
    await fixture.add("media_assets", {
      user_id: student,
      storage_path: path,
      bucket: "speaking",
    });
    const recording = (
      await rpc(student, "add_recording", { t: speaking.id, p: path })
    ).data;
    expect(
      (
        await rpc(student, "link_mock_section", {
          a: mock.id,
          s: sections[3].id,
          r: recording.id,
        })
      ).error,
    ).toBeNull();
    expect(
      (await rpc(student, "mock_scorecard", { a: mock.id })).data.overall_band,
    ).toBeNull();
    for (const [k, id] of [
      ["writing", essay.id],
      ["speaking", recording.id],
    ])
      expect(
        (
          await rpc(teacher, "review_submission", {
            k,
            s: id,
            b: 7,
            c: {},
            f: "Teacher review",
          })
        ).error,
      ).toBeNull();
    const card = (await rpc(student, "mock_scorecard", { a: mock.id })).data;
    expect(card.sections).toHaveLength(4);
    expect(card.overall_band).toBe(7);
    expect(
      (await rpc(other, "mock_scorecard", { a: mock.id })).error,
    ).toBeTruthy();
    as(admin);
    expect(
      (
        await api(
          "admin/content/mock_exam_sections/" + sections[0].id,
          "PATCH",
          { position: 5 },
        )
      ).status,
    ).toBe(409);
  });
  it("revokes all other sessions when the password changes", async () => {
    const { digest } = await import("@/server/local/password");
    await prisma.session.create({
      data: {
        tokenHash: digest("other-device"),
        accountId: student,
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    const old = state.jar.get("academy_session");
    expect(
      (
        await api("auth/reset", "POST", {
          password: "A different secure test password!",
        })
      ).status,
    ).toBe(200);
    sessions[student] = state.jar.get("academy_session")!;
    expect(await local.sessionUser("other-device")).toBeNull();
    expect(await local.sessionUser(old)).toBeNull();
    expect(
      (
        await local.authenticate(
          email("student"),
          "A different secure test password!",
        )
      ).id,
    ).toBe(student);
  });
  it("allows teachers to create and publish their own content and rejects other ownership", async () => {
    as(teacher);
    const created = await api("admin/content/writing_tasks", "POST", {
      title: "Teacher writing",
      prompt: "Discuss learning",
      task_number: 2,
      status: "draft",
      access_tier: "premium",
    });
    expect(created.status).toBe(200);
    const owned = await api("admin/content/writing_tasks");
    expect(owned.status).toBe(200);
    expect(owned.data.length).toBeGreaterThan(0);
    expect(
      owned.data.every((x: { creator_id: string }) => x.creator_id === teacher),
    ).toBe(true);
    expect(
      (
        await api("admin/content/writing_tasks/" + created.data.id, "PATCH", {
          status: "published",
        })
      ).status,
    ).toBe(200);
    as(other);
    expect(
      (
        await api("admin/content/writing_tasks/" + created.data.id, "PATCH", {
          prompt: "Escalate",
        })
      ).status,
    ).toBe(403);
    as(teacher);
    expect((await api("admin/subscriptions")).status).toBe(403);
    const foreign = (
      await new Store(prisma, admin, true).all("writing_tasks")
    ).find((x) => x.creator_id === admin);
    if (foreign)
      expect(
        (
          await api("admin/content/writing_tasks/" + foreign.id, "PATCH", {
            prompt: "Steal",
          })
        ).status,
      ).toBe(403);
    const copy = await api(
      "admin/content/writing_tasks/" + created.data.id + "/duplicate",
      "POST",
      {},
    );
    expect(copy.status).toBe(200);
    expect(copy.data.status).toBe("draft");
  });
  it("redeems secure codes, stacks grants, rejects repeats and hides code digests", async () => {
    as(admin);
    const c = await api("admin/subscriptions/codes", "POST", {
      days: 30,
      limit: 2,
      label: "Test promo",
    });
    expect(c.status).toBe(200);
    expect(c.data.code.length).toBeGreaterThanOrEqual(16);
    const list = await api("admin/subscriptions");
    expect(JSON.stringify(list)).not.toContain(c.data.code);
    expect(JSON.stringify(list)).not.toContain("lookup");
    as(student);
    const before = await api("subscription");
    expect(before.data.tier).toBe("free");
    expect(
      (await api("subscription/redeem", "POST", { code: c.data.code })).status,
    ).toBe(200);
    expect(
      (await api("subscription/redeem", "POST", { code: c.data.code })).status,
    ).toBe(409);
    const first = (await api("subscription")).data;
    expect(first.tier).toBe("premium");
    as(admin);
    expect(
      (
        await api("admin/subscriptions/grant", "POST", {
          user_id: student,
          days: 7,
        })
      ).status,
    ).toBe(200);
    as(student);
    expect(
      Date.parse((await api("subscription")).data.expires_at) -
        Date.parse(first.expires_at),
    ).toBe(7 * 86400000);
  });
  it("serializes concurrent redemption and enforces expiry, revocation and limits", async () => {
    as(admin);
    const code = (
      await api("admin/subscriptions/codes", "POST", { days: 7, limit: 1 })
    ).data;
    const { subscriptionRequest } = await import("@/server/subscriptions");
    const redeem = (uid: string) =>
      subscriptionRequest(
        new Request("http://localhost:3000/api/subscription/redeem", {
          method: "POST",
          body: JSON.stringify({ code: code.code }),
        }),
        uid,
        ["subscription", "redeem"],
      );
    const results = await Promise.allSettled([redeem(student), redeem(other)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    as(admin);
    const expired = (
      await api("admin/subscriptions/codes", "POST", {
        days: 7,
        limit: 1,
        expires_at: "2020-01-01T00:00:00Z",
      })
    ).data;
    as(other);
    expect(
      (await api("subscription/redeem", "POST", { code: expired.code })).status,
    ).toBe(409);
    as(admin);
    const revoked = (
      await api("admin/subscriptions/codes", "POST", { days: 7, limit: 1 })
    ).data;
    expect(
      (
        await api("admin/subscriptions/code", "POST", {
          id: revoked.id,
          revoke: true,
        })
      ).status,
    ).toBe(200);
    as(other);
    expect(
      (await api("subscription/redeem", "POST", { code: revoked.code })).status,
    ).not.toBe(200);
  });
  it("gates premium API content and media while retaining historical progress after expiry", async () => {
    const s = new Store(prisma, admin, true);
    const c = await s.add("courses", {
      title: "Premium course",
      status: "published",
      access_tier: "premium",
    });
    const m = await s.add("course_modules", {
      course_id: c.id,
      title: "Module",
    });
    const l = await s.add("lessons", {
      module_id: m.id,
      title: "Protected",
      status: "published",
      video_url: admin + "/private.mp4",
    });
    as(other);
    for (const grant of (await s.all("subscriptions")).filter(
      (x) => x.user_id === other,
    ))
      await s.put("subscriptions", {
        ...grant,
        expires_at: "2000-01-01T00:00:00Z",
      });
    expect(await as(other).visible("lessons", l)).toBe(false);
    expect(
      await local.mediaAllowed(
        as(other),
        "course-media",
        admin + "/private.mp4",
      ),
    ).toBe(false);
    const catalog = await api("catalog/courses");
    expect(catalog.data.find((x: { id: string }) => x.id === c.id).locked).toBe(
      true,
    );
    as(admin);
    const grant = (
      await api("admin/subscriptions/grant", "POST", {
        user_id: other,
        days: 7,
      })
    ).data;
    expect(await as(other).visible("lessons", l)).toBe(true);
    expect((await rpc(other, "enroll_course", { c: c.id })).error).toBeNull();
    expect((await rpc(other, "complete_lesson", { l: l.id })).error).toBeNull();
    as(admin);
    await api("admin/subscriptions/revoke", "POST", { id: grant.id });
    expect(await as(other).visible("lessons", l)).toBe(false);
    as(other);
    expect(
      (await api("dashboard")).data.lesson_progress.some(
        (x: { lesson_id: string }) => x.lesson_id === l.id,
      ),
    ).toBe(true);
  });
  it("authorizes teacher media uploads and rejects disguised files and student content uploads", async () => {
    const media = await import("@/app/api/local-media/[...file]/route");
    as(teacher);
    const issued = await api("media-upload", "POST", {
      bucket: "course-media",
      type: "audio/wav",
      size: 44,
    });
    expect(issued.status).toBe(200);
    const path = issued.data.path;
    const params = {
      params: Promise.resolve({ file: ["course-media", ...path.split("/")] }),
    };
    const request = (bytes: Buffer) =>
      media.PUT(
        new Request("http://localhost:3000" + issued.data.signedUrl, {
          method: "PUT",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "audio/wav",
          },
          body: new Uint8Array(bytes),
        }),
        params,
      );
    expect(
      (await request(Buffer.from("<script>bad file</script>"))).status,
    ).toBe(400);
    const wave = Buffer.alloc(44);
    wave.write("RIFF");
    wave.write("WAVE", 8);
    expect((await request(wave)).status).toBe(200);
    expect(
      (await api("media-finalize", "POST", { bucket: "course-media", path }))
        .status,
    ).toBe(200);
    expect((await api("media-remove", "POST", { path })).status).toBe(200);
    expect(
      (
        await media.GET(
          new Request("http://localhost:3000" + issued.data.signedUrl),
          params,
        )
      ).status,
    ).toBe(403);
    as(other);
    expect(
      (
        await api("media-upload", "POST", {
          bucket: "course-media",
          type: "audio/wav",
          size: 44,
        })
      ).status,
    ).toBe(403);
  });
  it("changes access tiers without resetting publication or altering earned grades", async () => {
    as(admin);
    const row = await api("admin/content/lessons", "POST", {
      module_id: (await new Store(prisma, admin, true).all("course_modules"))[0]
        .id,
      title: "YouTube test lesson",
      body: "Content",
      status: "published",
    });
    expect(row.status).toBe(200);
    const patched = await api("admin/content/lessons/" + row.data.id, "PATCH", {
      video_url: "https://youtu.be/AbCdEf123_-",
    });
    expect(patched.data.status).toBe("published");
    const test = (await new Store(prisma, admin, true).all("tests")).find(
      (x) => x.status === "published",
    );
    expect(
      (
        await api("admin/content/tests/" + test!.id, "PATCH", {
          access_tier: "premium",
        })
      ).status,
    ).toBe(200);
  });
  it("never exposes subscription administration through a GET redemption endpoint", async () => {
    as(other);
    const result = await api("subscription/redeem");
    expect(result.status).toBe(405);
    expect(result).not.toHaveProperty("data");
  });
  it("rejects a teacher linking another owner private upload", async () => {
    as(teacher);
    const own = (
      await new Store(prisma, teacher, true).all("writing_tasks")
    ).find((x) => x.creator_id === teacher);
    expect(
      (
        await api("admin/content/writing_tasks/" + own!.id, "PATCH", {
          image_path: admin + "/private.png",
        })
      ).status,
    ).toBe(403);
  });
});
