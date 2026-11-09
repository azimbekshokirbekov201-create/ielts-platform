// Real browser/API smoke test against an isolated, restartable production server.
// Run after `npm run build`; no fixtures are written to db/academy.db.
import { chromium, request, expect } from "@playwright/test";
import { mkdtempSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
const temporary = mkdtempSync(join(tmpdir(), "academy-browser-"));
const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DATABASE_URL: "file:" + join(temporary, "academy.db"),
  PRIVATE_UPLOAD_DIR: join(temporary, "uploads"),
  APP_URL: origin,
  SESSION_COOKIE_SECURE: "false",
};
const password = randomBytes(24).toString("hex");
const email = "browser-student@example.test",
  adminEmail = "browser-admin@example.test";
let child, browser, admin;
let logs = "";
async function start() {
  child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null)
      throw new Error("Production server exited: " + logs);
    try {
      if ((await fetch(origin + "/api/me")).status === 401) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Production server did not become ready: " + logs);
}
async function stop() {
  if (child && child.exitCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
  child = undefined;
}
async function api(context, path, method = "GET", data) {
  const response = await context.fetch(origin + "/api/" + path, {
    method,
    headers: { origin },
    ...(data === undefined ? {} : { data }),
  });
  const body = await response.json();
  expect(response.status(), `${method} ${path}: ${JSON.stringify(body)}`).toBe(
    200,
  );
  return body.data;
}
try {
  execFileSync(process.execPath, ["scripts/db-setup.mjs"], {
    env,
    stdio: "pipe",
  });
  await start();
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/register");
  await page.getByLabel("Full name", { exact: true }).fill("Browser learner");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel(/Password/).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(origin + "/onboarding");
  const session = (await context.cookies()).find(
    (x) => x.name === "academy_session",
  );
  expect(!!session).toBe(true);
  expect(session.httpOnly).toBe(true);
  expect(session.sameSite).toBe("Lax");
  const choose = (name) =>
    page.getByRole("button", { name, exact: true }).click();
  const next = () => choose("Continue");
  await choose("Start");
  await choose("Career opportunities");
  await next();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What’s your dream IELTS score?" }),
  ).toBeVisible();
  await choose("7.5");
  await next();
  await choose("Intermediate");
  await next();
  await choose("Reading");
  await next();
  await choose("30");
  await next();
  await choose("Monday");
  await next();
  await next();
  await choose("Finish");
  await expect
    .poll(async () => (await api(context.request, "me")).onboarding.completed)
    .toBe(true);
  console.log(
    "PASS real browser registration, HttpOnly session and onboarding save/resume",
  );
  admin = await request.newContext();
  await api(admin, "auth/register", "POST", {
    email: adminEmail,
    password,
    name: "Isolated administrator",
  });
  execFileSync(process.execPath, ["scripts/first-admin.mjs", adminEmail], {
    env,
    stdio: "pipe",
  });
  const create = (table, body) =>
    api(admin, "admin/content/" + table, "POST", body);
  const course = await create("courses", {
    title: "Isolated browser course",
    status: "published",
  });
  const courseModule = await create("course_modules", {
    course_id: course.id,
    title: "Browser module",
  });
  const lesson = await create("lessons", {
    module_id: courseModule.id,
    title: "Persisted lesson",
    body: "Locally stored lesson",
    status: "published",
  });
  const test = await create("tests", {
    title: "Isolated reading test",
    skill: "reading",
    duration_seconds: 600,
    band_thresholds: [
      { min: 0, band: 0 },
      { min: 1, band: 7 },
    ],
  });
  const section = await create("test_sections", {
    test_id: test.id,
    title: "Section",
  });
  const question = await create("questions", {
    section_id: section.id,
    prompt: "What is the answer?",
    kind: "text",
    position: 0,
  });
  await create("answer_keys", {
    question_id: question.id,
    accepted: ["correct"],
  });
  await api(admin, "admin/content/tests/" + test.id, "PATCH", {
    status: "published",
  });
  await create("writing_tasks", {
    title: "Isolated writing task",
    prompt: "Write a response.",
    task_number: 2,
    status: "published",
  });
  const speaking = await create("speaking_tasks", {
    title: "Isolated speaking task",
    prompt: "Speak about learning.",
    part: 1,
    status: "published",
  });
  await page.goto(origin + "/courses");
  const enrolled = page.waitForResponse((r) => r.url().endsWith("/api/enroll"));
  await choose("Enroll");
  expect((await enrolled).status()).toBe(200);
  await choose("Preview");
  await expect(
    page.getByRole("heading", { name: "Persisted lesson" }),
  ).toBeVisible();
  const completed = page.waitForResponse((r) =>
    r.url().endsWith("/api/complete"),
  );
  await choose("Mark lesson complete");
  expect((await completed).status()).toBe(200);
  await page.goto(origin + "/practice/reading");
  await choose("Start");
  await page.getByRole("textbox", { name: "Your answer 1" }).fill("correct");
  await expect
    .poll(async () => {
      const attempts = await api(context.request, "attempts");
      if (!attempts.length) return false;
      const attempt = await api(context.request, "attempts/" + attempts[0].id);
      return attempt.student_answers?.some((x) => x.answer === "correct");
    })
    .toBe(true);
  await choose("Submit");
  await expect
    .poll(async () => (await api(context.request, "attempts"))[0]?.raw_score)
    .toBe(1);
  console.log(
    "PASS real browser enrollment, lesson completion, autosave and server grading",
  );
  await page.goto(origin + "/practice/writing");
  await choose("Start");
  await page
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill("My genuine saved writing response.");
  await expect
    .poll(
      async () => (await api(context.request, "submissions")).writing[0]?.body,
    )
    .toBe("My genuine saved writing response.");
  await choose("Submit");
  await expect
    .poll(
      async () =>
        !!(await api(context.request, "submissions")).writing[0]?.submitted_at,
    )
    .toBe(true);
  const issued = await api(context.request, "media-upload", "POST", {
    bucket: "speaking",
    type: "audio/wav",
    size: 44,
  });
  const wav = Buffer.alloc(44);
  wav.write("RIFF");
  wav.write("WAVE", 8);
  const upload = await context.request.put(origin + issued.signedUrl, {
    headers: { origin, "content-type": "audio/wav" },
    data: wav,
  });
  expect(upload.status()).toBe(200);
  await api(context.request, "media-finalize", "POST", {
    bucket: "speaking",
    path: issued.path,
  });
  await api(context.request, "speaking", "POST", {
    task_id: speaking.id,
    path: issued.path,
  });
  const readUrl = (
    await api(context.request, "media-url", "POST", {
      bucket: "speaking",
      path: issued.path,
    })
  ).signedUrl;
  expect((await context.request.get(origin + readUrl)).status()).toBe(200);
  const anonymous = await request.newContext();
  expect((await anonymous.get(origin + readUrl)).status()).toBe(401);
  await anonymous.dispose();
  expect(
    (await context.request.get(origin + "/api/admin/users")).status(),
  ).toBe(403);
  const student = await api(context.request, "me");
  const teacher = await request.newContext();
  await api(teacher, "auth/register", "POST", {
    email: "teacher@example.test",
    password,
    name: "Isolated teacher",
  });
  const teacherId = (await api(teacher, "me")).id;
  await api(admin, "admin/roles", "POST", {
    user_id: teacherId,
    role: "TEACHER",
  });
  expect((await teacher.get(origin + readUrl)).status()).toBe(403);
  await api(admin, "admin/assign-teacher", "POST", {
    teacher_id: teacherId,
    student_id: student.id,
  });
  expect((await teacher.get(origin + readUrl)).status()).toBe(200);
  await teacher.dispose();
  console.log(
    "PASS persisted writing/audio submissions and Student/Teacher/Admin access controls",
  );
  await stop();
  await start();
  const me = await api(context.request, "me");
  expect(me.id).toBe(student.id);
  expect(me.onboarding.completed).toBe(true);
  const dashboard = await api(context.request, "dashboard");
  expect(dashboard.lesson_progress.some((x) => x.lesson_id === lesson.id)).toBe(
    true,
  );
  expect(dashboard.test_attempts[0].raw_score).toBe(1);
  const submissions = await api(context.request, "submissions");
  expect(submissions.writing[0].body).toBe(
    "My genuine saved writing response.",
  );
  expect(submissions.speaking[0].storage_path).toBe(issued.path);
  expect((await context.request.get(origin + readUrl)).status()).toBe(200);
  await page.goto(origin + "/dashboard");
  await expect(
    page.getByRole("heading", { name: /dashboard/i }).first(),
  ).toBeVisible();
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/sqlite-dashboard.png",
    fullPage: true,
  });
  console.log(
    "PASS session, onboarding, grades, progress, submissions and private audio survive server restart",
  );
  await api(context.request, "auth/logout", "POST", {});
  expect((await context.request.get(origin + "/api/me")).status()).toBe(401);
  await page.goto(origin + "/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel(/Password/).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(origin + "/dashboard");
  expect(errors).toEqual([]);
  console.log(
    "PASS real browser logout/login and no browser JavaScript errors",
  );
} catch (error) {
  console.error("Local browser verification failed. Server output:\n" + logs);
  throw error;
} finally {
  await browser?.close();
  await admin?.dispose();
  await stop();
  rmSync(temporary, { recursive: true, force: true });
}
