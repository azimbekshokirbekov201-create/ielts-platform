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
  it("authorizes teacher media uploads and rejects student content uploads", async () => {
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
async function newUser(name: string) {
  state.jar.clear();
  expect(
    (
      await api("auth/register", "POST", {
        email: email(name + randomUUID().slice(0, 6)),
        password,
        name,
      })
    ).status,
  ).toBe(200);
  const me = await api("me");
  sessions[me.data.id] = state.jar.get("academy_session")!;
  return me.data.id as string;
}
const future = () => new Date(Date.now() + 30 * 86400000).toISOString();
describe("Editable promo codes, scoped access, paid platform and HTML import", () => {
  it("edits a promo code's days, limit, expiry and scope and guards limit/delete rules", async () => {
    as(admin);
    const c = (
      await api("admin/subscriptions/codes", "POST", {
        days: 30,
        limit: 2,
        label: "Edit me",
      })
    ).data;
    const edit = await api("admin/subscriptions/code", "POST", {
      id: c.id,
      label: "Edited",
      days: 90,
      limit: 5,
      expires_at: future(),
      scope: ["reading", "writing"],
    });
    expect(edit.status).toBe(200);
    const row = (await api("admin/subscriptions")).data.codes.find(
      (x: { id: string }) => x.id === c.id,
    );
    expect(row).toMatchObject({
      label: "Edited",
      days: 90,
      limit: 5,
      scope: ["reading", "writing"],
    });
    expect(row.expires_at).not.toBeNull();
    const user = await newUser("promo-edit");
    expect(
      (await api("subscription/redeem", "POST", { code: c.code })).status,
    ).toBe(200);
    as(admin);
    const low = await api("admin/subscriptions/code", "POST", {
      id: c.id,
      limit: 0 + 1 - 1 || 1,
    });
    expect(low.status).toBe(200); // used=1, limit 1 is allowed
    const tooLow = await api("admin/subscriptions/code", "POST", {
      id: c.id,
      limit: 1,
      days: 10,
    });
    expect(tooLow.status).toBe(200);
    expect(
      (
        await api("admin/subscriptions/code", "POST", {
          id: c.id,
          delete: true,
        })
      ).detail,
    ).toBe("reason_code_used");
    const unused = (
      await api("admin/subscriptions/codes", "POST", { days: 3, limit: 1 })
    ).data;
    expect(
      (
        await api("admin/subscriptions/code", "POST", {
          id: unused.id,
          revoke: true,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("admin/subscriptions/code", "POST", {
          id: unused.id,
          revoke: false,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("admin/subscriptions/code", "POST", {
          id: unused.id,
          delete: true,
        })
      ).status,
    ).toBe(200);
    // the redeemed grant copied the scope and the days from when it was redeemed
    const grant = (await api("admin/subscriptions")).data.subscriptions.find(
      (x: { user_id: string }) => x.user_id === user,
    );
    expect(grant.scope).toEqual(["reading", "writing"]);
  });
  it("rejects a limit below the redemptions already used with a readable reason", async () => {
    as(admin);
    const c = (
      await api("admin/subscriptions/codes", "POST", { days: 3, limit: 3 })
    ).data;
    for (const name of ["lim-a", "lim-b"]) {
      await newUser(name);
      expect(
        (await api("subscription/redeem", "POST", { code: c.code })).status,
      ).toBe(200);
    }
    as(admin);
    const r = await api("admin/subscriptions/code", "POST", {
      id: c.id,
      limit: 1,
    });
    expect(r.status).toBe(409);
    expect(r.detail).toBe("reason_limit_below_used");
  });
  it("limits a scoped code to the chosen categories", async () => {
    const s = new Store(prisma, admin, true);
    const reading = await s.add("tests", {
      title: "Scoped reading",
      skill: "reading",
      variant: "academic",
      duration_seconds: 3600,
      status: "published",
      access_tier: "premium",
    });
    const writing = await s.add("writing_tasks", {
      title: "Scoped writing",
      prompt: "x",
      task_number: 2,
      suggested_words: 250,
      duration_seconds: 2400,
      status: "published",
      access_tier: "premium",
    });
    as(admin);
    const c = (
      await api("admin/subscriptions/codes", "POST", {
        days: 7,
        limit: 1,
        scope: ["reading"],
      })
    ).data;
    const user = await newUser("scoped");
    expect(await as(user).visible("tests", reading)).toBe(false);
    expect(
      (await api("subscription/redeem", "POST", { code: c.code })).status,
    ).toBe(200);
    const mine = (await api("subscription")).data;
    expect(mine.tier).toBe("premium");
    expect(mine.scope).toEqual(["reading"]);
    expect(await as(user).visible("tests", reading)).toBe(true);
    expect(await as(user).visible("writing_tasks", writing)).toBe(false);
    const catalog = (await api("catalog/writing_tasks")).data;
    expect(
      catalog.find((x: { id: string }) => x.id === writing.id).locked,
    ).toBe(true);
    // a full grant opens everything and does not stack onto the scoped one
    as(admin);
    expect(
      (
        await api("admin/subscriptions/grant", "POST", {
          user_id: user,
          days: 7,
        })
      ).status,
    ).toBe(200);
    expect(await as(user).visible("writing_tasks", writing)).toBe(true);
  });
  it("makes the platform paid when the paywall is on, except content marked free", async () => {
    const s = new Store(prisma, admin, true);
    const untagged = await s.add("writing_tasks", {
      title: "No tier set",
      prompt: "x",
      task_number: 2,
      suggested_words: 250,
      duration_seconds: 2400,
      status: "published",
    });
    const sample = await s.add("writing_tasks", {
      title: "Free sample",
      prompt: "x",
      task_number: 2,
      suggested_words: 250,
      duration_seconds: 2400,
      status: "published",
      access_tier: "free",
    });
    const user = await newUser("paywall");
    expect(await as(user).visible("writing_tasks", untagged)).toBe(true);
    as(admin);
    expect(
      (await api("admin/settings", "PATCH", { paywall_enabled: true })).status,
    ).toBe(200);
    expect(await as(user).visible("writing_tasks", untagged)).toBe(false);
    expect(await as(user).visible("writing_tasks", sample)).toBe(true);
    expect(
      (await api("catalog/writing_tasks")).data.find(
        (x: { id: string }) => x.id === untagged.id,
      ).locked,
    ).toBe(true);
    // admins and the AI settings keep working with a partial settings update
    as(admin);
    const settings = (await api("admin/settings")).data;
    expect(settings.paywall_enabled).toBe(true);
    expect(settings.ai_daily_user_limit).toBe(5);
    // a promo code opens it
    const c = (
      await api("admin/subscriptions/codes", "POST", { days: 1, limit: 1 })
    ).data;
    as(user);
    expect(
      (await api("subscription/redeem", "POST", { code: c.code })).status,
    ).toBe(200);
    expect(await as(user).visible("writing_tasks", untagged)).toBe(true);
    // bulk switch and switching the paywall back off
    as(admin);
    const bulk = await api("admin/content-tier", "POST", { tier: "free" });
    expect(bulk.status).toBe(200);
    expect(bulk.data.changed).toBeGreaterThan(0);
    await api("admin/settings", "PATCH", { paywall_enabled: false });
    expect(
      (await api("admin/content-tier", "POST", { tier: "nope" })).status,
    ).toBe(400);
    state.jar.set("academy_session", sessions[student]);
    expect(
      (await api("admin/content-tier", "POST", { tier: "free" })).status,
    ).toBe(403);
  });
  it("explains rejected saves with the invalid field or the broken rule", async () => {
    as(admin);
    const long = "x".repeat(2001);
    const bad = await api("admin/content/writing_tasks", "POST", {
      title: "T",
      prompt: "",
      task_number: 2,
      suggested_words: 250,
      duration_seconds: 2400,
    });
    expect(bad.status).toBe(400);
    expect(bad.detail).toBe("fields:prompt");
    const test = (
      await api("admin/content/tests", "POST", {
        title: "Reasons",
        skill: "reading",
        variant: "academic",
        duration_seconds: 3600,
      })
    ).data;
    const section = (
      await api("admin/content/test_sections", "POST", {
        test_id: test.id,
        title: "S1",
        position: 0,
      })
    ).data;
    // a realistic 600-character question prompt is accepted now
    const q = await api("admin/content/questions", "POST", {
      section_id: section.id,
      prompt: "Which statement best matches paragraph B? ".repeat(15),
      kind: "text",
      position: 0,
      points: 1,
    });
    expect(q.status).toBe(200);
    expect(
      (
        await api("admin/content/questions", "POST", {
          section_id: section.id,
          prompt: long,
          kind: "text",
          position: 1,
          points: 1,
        })
      ).detail,
    ).toBe("fields:prompt");
    const publish = await api("admin/content/tests/" + test.id, "PATCH", {
      status: "published",
    });
    expect(publish.status).toBe(409);
    expect(publish.detail).toMatch(/^reason_missing_key:1/);
    const parent = await api(
      "admin/content/test_sections/" + section.id,
      "DELETE",
    );
    expect(parent.status).toBe(409);
    expect(parent.detail).toBe("reason_in_use:questions");
  });
  it("gives an estimated IELTS band when a test has no custom thresholds", async () => {
    const s = new Store(prisma, admin, true);
    const test = await s.add("tests", {
      title: "Band test",
      skill: "reading",
      variant: "academic",
      duration_seconds: 600,
      status: "published",
      access_tier: "free",
    });
    const sec = await s.add("test_sections", {
      test_id: test.id,
      title: "S",
      position: 0,
    });
    const q = await s.add("questions", {
      section_id: sec.id,
      prompt: "Capital?",
      kind: "text",
      position: 0,
      points: 1,
    });
    await s.add("answer_keys", {
      question_id: q.id,
      accepted: ["paris"],
      explanation: "",
    });
    const user = await newUser("band");
    const attempt = (await api("attempts", "POST", { test_id: test.id })).data;
    const id = attempt.id || attempt.attempt_id;
    await api("attempts/" + id, "PATCH", { answers: { [q.id]: "Paris" } });
    const done = await api("attempts/" + id + "/submit", "POST", {});
    expect(done.status).toBe(200);
    const result = (await api("attempts/" + id)).data;
    expect(result.raw_score).toBe(1);
    expect(result.band).toBe(9);
    void user;
  });
  it("imports a 40-question CDI HTML test in one request (no rate limit) as a draft", async () => {
    const passages: Record<string, unknown> = {};
    const sections: Record<string, unknown> = {};
    for (const p of [1, 2, 3]) {
      passages[p] = {
        title: "Passage " + p,
        content:
          "<p><b>A</b> First paragraph &amp; more.</p><p><b>B</b> Second.</p>",
        headings: [
          { id: "i", text: "Origins" },
          { id: "ii", text: "Trade" },
        ],
      };
      const n = (k: number) => (p - 1) * 14 + k;
      sections[p] = [
        {
          type: "tfng",
          items: [1, 2, 3, 4, 5].map((k) => ({
            id: n(k),
            label: "Statement " + n(k),
            answer: "T",
          })),
        },
        {
          type: "matching-headings",
          items: [6, 7].map((k) => ({
            id: n(k),
            label: "Paragraph",
            answer: "ii",
          })),
        },
        {
          type: "mcq",
          items: [8].map((k) => ({
            id: n(k),
            label: "Pick one",
            options: ["Cat", "Dog", "Bird"],
            answer: "Dog",
          })),
        },
        {
          type: "fill",
          wordLimit: 2,
          items: [9, 10, 11, 12, 13].map((k) => ({
            id: n(k),
            label: "Fill " + n(k),
            answer: ["milk", "sugar"],
          })),
        },
      ];
    }
    // JavaScript-literal style (unquoted keys, single quotes, trailing commas, comments)
    const literal = (v: unknown) =>
      JSON.stringify(v, null, 1)
        .replace(/"(\w+)":/g, "$1:")
        .replace(/: "([^"\\]*)"/g, ": '$1'");
    const html = `<html><head><title>Cambridge 19 Reading</title></head><body><script>
      // test data
      const PASSAGES = ${literal(passages)};
      const SECTIONS = ${literal(sections)}; /* end */
      const READING_EXPLANATIONS = { 1: 'Because paragraph A says so.', };
    </script></body></html>`;
    as(admin);
    const dry = await api("admin/import-html", "POST", {
      html,
      title: "Cambridge 19",
      dry_run: true,
    });
    expect(dry.status).toBe(200);
    expect(dry.data).toMatchObject({
      skill: "reading",
      parts: 3,
      questions: 39,
      detected_title: "Cambridge 19 Reading",
      test_id: null,
    });
    const before = await prisma.entity.count({ where: { kind: "questions" } });
    as(teacher);
    const run = await api("admin/import-html", "POST", {
      html,
      title: "Cambridge 19",
      access_tier: "premium",
    });
    expect(run.status).toBe(200);
    const store = new Store(prisma, admin, true);
    const test = await store.get("tests", run.data.test_id);
    expect(test).toMatchObject({
      status: "draft",
      skill: "reading",
      access_tier: "premium",
    });
    expect(await prisma.entity.count({ where: { kind: "questions" } })).toBe(
      before + 39,
    );
    const sectionIds = (await store.all("test_sections"))
      .filter((x) => x.test_id === test!.id)
      .map((x) => x.id);
    expect(sectionIds).toHaveLength(3);
    const passage = (await store.all("passages")).find(
      (x) => x.section_id === sectionIds[0],
    );
    expect(passage!.body).toBe("A First paragraph & more.\nB Second.");
    const qs = (await store.all("questions")).filter((x) =>
      sectionIds.includes(x.section_id),
    );
    const keys = await store.all("answer_keys");
    const tf = qs.find((x) => x.prompt === "Statement 1")!;
    expect(tf.kind).toBe("true_false_not_given");
    expect(keys.find((k) => k.question_id === tf.id)).toMatchObject({
      accepted: ["TRUE"],
      explanation: "Because paragraph A says so.",
    });
    const mcq = qs.find((x) => x.prompt === "Pick one")!;
    expect(keys.find((k) => k.question_id === mcq.id)!.accepted).toEqual(["B"]);
    const fill = qs.find((x) => x.prompt === "Fill 9")!;
    expect(fill.max_words).toBe(2);
    expect(keys.find((k) => k.question_id === fill.id)!.accepted).toEqual([
      "milk",
      "sugar",
    ]);
    // every question has a key, so it can be published right away
    as(admin);
    expect(
      (
        await api("admin/content/tests/" + test!.id, "PATCH", {
          status: "published",
        })
      ).status,
    ).toBe(200);
  });
  it("rejects HTML without recognizable test data and never runs uploaded code", async () => {
    as(admin);
    const none = await api("admin/import-html", "POST", {
      html: "<html><body><script>const x = {a: 1};</script></body></html>",
      title: "Nothing",
    });
    expect(none.status).toBe(400);
    expect(none.detail).toMatch(/^reason_html_unrecognized/);
    const code = await api("admin/import-html", "POST", {
      html: "<script>const SECTIONS = {1: [(() => { globalThis.pwned = 1; return 1 })()]};</script>",
      title: "Code",
    });
    expect(code.status).toBe(400);
    expect(code.detail).toMatch(/^reason_html_parse:SECTIONS/);
    expect((globalThis as { pwned?: number }).pwned).toBeUndefined();
    as(student);
    expect(
      (
        await api("admin/import-html", "POST", {
          html: "x".repeat(50),
          title: "T",
        })
      ).status,
    ).toBe(403);
  });
});

describe("Deleting content", () => {
  it("lets authors delete unused content but still protects referenced and attempted content", async () => {
    as(teacher);
    const course = (
      await api("admin/content/courses", "POST", {
        title: "Delete me",
        description: "",
        status: "draft",
        access_tier: "free",
      })
    ).data;
    const courseModule = (
      await api("admin/content/course_modules", "POST", {
        course_id: course.id,
        title: "M",
        position: 0,
      })
    ).data;
    // children block the parent with a readable reason...
    const blocked = await api("admin/content/courses/" + course.id, "DELETE");
    expect(blocked.status).toBe(409);
    expect(blocked.detail).toBe("reason_in_use:course_modules");
    // ...and removing them bottom-up works, audit history notwithstanding
    expect(
      (await api("admin/content/course_modules/" + courseModule.id, "DELETE"))
        .status,
    ).toBe(200);
    expect(
      (await api("admin/content/courses/" + course.id, "DELETE")).status,
    ).toBe(200);
  });
});

async function authorUpload(name: string, type: string, bytes: Buffer) {
  const media = await import("@/app/api/local-media/[...file]/route");
  const issued = await api("media-upload", "POST", {
    bucket: "course-media",
    type,
    name,
    size: bytes.length,
  });
  expect(issued.status).toBe(200);
  const path = issued.data.path as string;
  const params = {
    params: Promise.resolve({ file: ["course-media", ...path.split("/")] }),
  };
  const put = await media.PUT(
    new Request("http://localhost:3000" + issued.data.signedUrl, {
      method: "PUT",
      headers: { origin: "http://localhost:3000", "content-type": type },
      body: new Uint8Array(bytes),
    }),
    params,
  );
  expect(put.status).toBe(200);
  expect(
    (
      await api("media-finalize", "POST", {
        bucket: "course-media",
        path,
        name,
      })
    ).status,
  ).toBe(200);
  return {
    path,
    get: () =>
      media.GET(
        new Request("http://localhost:3000" + issued.data.signedUrl),
        params,
      ),
  };
}
describe("Any file type for authors, pages in a sandbox, HTML tests", () => {
  it("accepts any file type from authors and delivers it safely", async () => {
    as(teacher);
    const page = await authorUpload(
      "Exam 1.html",
      "",
      Buffer.from("<html><script>alert(1)</script></html>"),
    );
    expect(page.path).toMatch(/\.html$/);
    const html = await page.get();
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toMatch(/^text\/html/);
    expect(html.headers.get("content-security-policy")).toMatch(
      /^sandbox allow-scripts/,
    );
    expect(html.headers.get("content-security-policy")).not.toMatch(
      /allow-same-origin/,
    );
    expect(html.headers.get("x-content-type-options")).toBe("nosniff");
    // the claimed type is ignored: an "image" that is really a program is only ever a download
    const exe = await authorUpload(
      "setup.exe",
      "image/png",
      Buffer.from("MZ not an image"),
    );
    const download = await exe.get();
    expect(download.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(download.headers.get("content-disposition")).toBe("attachment");
    const zip = await authorUpload(
      "pack.zip",
      "application/zip",
      Buffer.from("PK\u0003\u0004data"),
    );
    expect((await zip.get()).headers.get("content-disposition")).toBe(
      "attachment",
    );
    const noExt = await authorUpload("README", "", Buffer.from("hello"));
    expect(noExt.path).toMatch(/\.bin$/);
    // a pdf keeps being shown inline
    const pdf = await authorUpload(
      "a.pdf",
      "application/pdf",
      Buffer.from("%PDF-1.4 x"),
    );
    expect((await pdf.get()).headers.get("content-type")).toBe(
      "application/pdf",
    );
  });
  it("enforces the configurable size limit and keeps student recordings audio-only", async () => {
    as(teacher);
    const before = process.env.MAX_UPLOAD_MB;
    process.env.MAX_UPLOAD_MB = "1";
    try {
      const big = await api("media-upload", "POST", {
        bucket: "course-media",
        type: "",
        name: "big.html",
        size: 2 * 1048576,
      });
      expect(big.status).toBe(413);
      expect(big.error).toBe("too_large");
    } finally {
      if (before === undefined) delete process.env.MAX_UPLOAD_MB;
      else process.env.MAX_UPLOAD_MB = before;
    }
    expect(
      (
        await api("media-upload", "POST", {
          bucket: "course-media",
          type: "",
          name: "big.html",
          size: 90 * 1048576,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("media-upload", "POST", {
          bucket: "course-media",
          type: "",
          name: "huge.html",
          size: 150 * 1048576,
        })
      ).status,
    ).toBe(413);
    await newUser("recorder");
    expect(
      (
        await api("media-upload", "POST", {
          bucket: "speaking",
          type: "text/html",
          name: "x.html",
          size: 100,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api("media-upload", "POST", {
          bucket: "course-media",
          type: "",
          name: "x.html",
          size: 100,
        })
      ).status,
    ).toBe(403);
  });
  it("hosts an HTML test as-is, gated by premium access and subscription scope", async () => {
    as(teacher);
    const file = await authorUpload(
      "My Test.html",
      "text/html",
      Buffer.from("<html><body>exam</body></html>"),
    );
    const created = await api("admin/content/html_tests", "POST", {
      title: "CDI Reading 12",
      html_path: file.path,
      status: "published",
      access_tier: "premium",
    });
    expect(created.status).toBe(200);
    // authors cannot point a test at somebody else's file
    const stolen = await api("admin/content/html_tests", "POST", {
      title: "Stolen",
      html_path: admin + "/" + randomUUID() + ".html",
    });
    expect(stolen.status).toBe(403);
    expect(
      (
        await api("admin/content/html_tests", "POST", {
          title: "No file",
          html_path: "",
        })
      ).detail,
    ).toBe("fields:html_path");
    const user = await newUser("html-student");
    const listed = (await api("catalog/html_tests")).data as {
      id: string;
      locked?: boolean;
    }[];
    expect(listed.find((x) => x.id === created.data.id)?.locked).toBe(true);
    expect(
      (
        await api("media-url", "POST", {
          bucket: "course-media",
          path: file.path,
        })
      ).status,
    ).toBe(403);
    // a code that only unlocks Reading does not open HTML tests; one for "html" does
    as(admin);
    const reading = (
      await api("admin/subscriptions/codes", "POST", {
        days: 2,
        limit: 1,
        scope: ["reading"],
      })
    ).data;
    const html = (
      await api("admin/subscriptions/codes", "POST", {
        days: 2,
        limit: 1,
        scope: ["html"],
      })
    ).data;
    as(user);
    expect(
      (await api("subscription/redeem", "POST", { code: reading.code })).status,
    ).toBe(200);
    expect(
      (
        await api("media-url", "POST", {
          bucket: "course-media",
          path: file.path,
        })
      ).status,
    ).toBe(403);
    expect(
      (await api("subscription/redeem", "POST", { code: html.code })).status,
    ).toBe(200);
    const open = (await api("catalog/html_tests")).data as {
      id: string;
      html_path?: string;
      locked?: boolean;
    }[];
    const row = open.find((x) => x.id === created.data.id)!;
    expect(row.locked).toBeUndefined();
    expect(row.html_path).toBe(file.path);
    const link = await api("media-url", "POST", {
      bucket: "course-media",
      path: file.path,
    });
    expect(link.status).toBe(200);
    expect(link.data.signedUrl).toContain("/api/local-media/course-media/");
    // drafts are never listed for students
    as(teacher);
    await api("admin/content/html_tests/" + created.data.id, "PATCH", {
      status: "draft",
    });
    as(user);
    expect(
      ((await api("catalog/html_tests")).data as { id: string }[]).some(
        (x) => x.id === created.data.id,
      ),
    ).toBe(false);
  });
});
