import { test, expect } from "@playwright/test";
test("public landing, languages and secure account form", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your ambition/ }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("uz");
  await expect(
    page.getByRole("heading", { name: /Sizning maqsadingiz/ }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Til" }).selectOption("ru");
  await expect(
    page.getByRole("heading", { name: /Ваши амбиции/ }),
  ).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByLabel(/Password/)).toHaveAttribute("minlength", "12");
  await expect(page.getByText("Demo role")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /student|teacher|admin/i }),
  ).toHaveCount(0);
});
test("rejects cross-origin mutations before processing credentials", async ({
  request,
}) => {
  const r = await request.post("/api/auth/login", {
    headers: { origin: "https://attacker.example" },
    data: { email: "a@example.test", password: "irrelevant-password" },
  });
  expect(r.status()).toBe(403);
  expect((await r.json()).error).toBe("forbidden");
});
test("anonymous API never returns private data", async ({ request }) => {
  const r = await request.get("/api/submissions");
  expect([401, 503]).toContain(r.status());
  expect(await r.json()).not.toHaveProperty("data");
});
const me = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "test@example.test",
  profile: { display_name: "Test learner" },
  preferences: { language: "en", theme: "light", ai_consent: false },
  roles: ["STUDENT"],
  onboarding: null as Record<string, unknown> | null,
  destination: "/onboarding",
};
test("onboarding saves every step, resumes and summarizes genuine answers", async ({
  page,
}) => {
  const current = structuredClone(me);
  const saves: Record<string, unknown>[] = [];
  await page.route("**/api/me", (r) => r.fulfill({ json: { data: current } }));
  await page.route("**/api/onboarding", async (r) => {
    const p = r.request().postDataJSON();
    saves.push(p);
    current.onboarding = {
      ...current.onboarding,
      ...p.answers,
      completed: p.finish,
    };
    if (p.finish) current.destination = "/dashboard";
    await r.fulfill({ json: { data: current.onboarding } });
  });
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page
    .getByRole("button", { name: "Career opportunities", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What’s your dream IELTS score?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "7.5", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Intermediate", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  await page.getByRole("button", { name: "Speaking", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "30", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Monday", exact: true }).click();
  await page.getByRole("button", { name: "Friday", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your learning profile" }),
  ).toBeVisible();
  await expect(
    page.getByText("Career opportunities", { exact: false }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  expect(saves).toHaveLength(9);
  expect(current.onboarding?.priority_skills).toEqual(["reading", "speaking"]);
  expect(current.onboarding?.completed).toBe(true);
});
test("published catalog displays an empty state without fake content", async ({
  page,
}) => {
  await page.route("**/api/me", (r) =>
    r.fulfill({
      json: {
        data: {
          ...me,
          destination: "/dashboard",
          onboarding: { completed: true },
        },
      },
    }),
  );
  await page.route("**/api/catalog/tests*", (r) =>
    r.fulfill({ json: { data: [] } }),
  );
  await page.goto("/practice/reading");
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toHaveCount(0);
});
test("errors and pending requests have visible states", async ({ page }) => {
  await page.route("**/api/me", (r) =>
    r.fulfill({
      json: {
        data: {
          ...me,
          destination: "/dashboard",
          onboarding: { completed: true },
        },
      },
    }),
  );
  await page.route("**/api/catalog/courses", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await r.fulfill({ status: 500, json: { error: "server_error" } });
  });
  await page.goto("/courses");
  await expect(page.getByRole("status")).toContainText("Loading");
  await expect(
    page.getByRole("alert").filter({ hasText: "could not complete" }),
  ).toBeVisible();
});
for (const width of [320, 375, 768, 1440])
  test(`public layout fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("admin creates drafts and explicitly publishes/unpublishes through APIs", async ({
  page,
}) => {
  const rows: Record<string, unknown>[] = [];
  await page.route("**/api/me", (r) =>
    r.fulfill({
      json: {
        data: { ...me, roles: ["STUDENT", "ADMIN"], destination: "/admin" },
      },
    }),
  );
  await page.route("**/api/admin/stats", (r) =>
    r.fulfill({
      json: { data: { users: 1, published_tests: 0, completed_attempts: 0 } },
    }),
  );
  await page.route("**/api/admin/content/courses**", async (r) => {
    const request = r.request();
    if (request.method() === "POST")
      rows.push({
        id: "20000000-0000-4000-8000-000000000001",
        ...request.postDataJSON(),
      });
    if (request.method() === "PATCH")
      Object.assign(rows[0], request.postDataJSON());
    await r.fulfill({
      json: { data: request.method() === "GET" ? rows : rows[0] },
    });
  });
  await page.goto("/admin");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Isolated course fixture");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Only a browser test fixture.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Isolated course fixture" }),
  ).toBeVisible();
  expect(rows[0].status).toBe("draft");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unpublish", exact: true }),
  ).toBeVisible();
  expect(rows[0].status).toBe("published");
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeVisible();
  expect(rows[0].status).toBe("draft");
});
test("objective exam autosaves answers without client scores", async ({
  page,
}) => {
  const testId = "20000000-0000-4000-8000-000000000001",
    attemptId = "20000000-0000-4000-8000-000000000002",
    questionId = "20000000-0000-4000-8000-000000000003";
  const writes: Record<string, unknown>[] = [];
  const attempt = {
    id: attemptId,
    status: "in_progress",
    deadline: new Date(Date.now() + 600000).toISOString(),
    student_answers: [],
  };
  await page.route("**/api/me", (r) =>
    r.fulfill({
      json: {
        data: {
          ...me,
          destination: "/dashboard",
          onboarding: { completed: true },
        },
      },
    }),
  );
  await page.route("**/api/catalog/tests*", (r) =>
    r.fulfill({
      json: {
        data: [
          { id: testId, title: "Isolated exam fixture", variant: "academic" },
        ],
      },
    }),
  );
  await page.route("**/api/test/*", (r) =>
    r.fulfill({
      json: {
        data: {
          id: testId,
          title: "Isolated exam fixture",
          test_sections: [
            {
              id: "section",
              title: "Section",
              position: 0,
              passages: [],
              questions: [
                {
                  id: questionId,
                  prompt: "Your response",
                  kind: "text",
                  position: 0,
                  question_options: [],
                },
              ],
            },
          ],
        },
      },
    }),
  );
  await page.route("**/api/attempts**", async (r) => {
    const req = r.request();
    if (req.method() === "PATCH") {
      writes.push(req.postDataJSON());
      await r.fulfill({ json: { data: null } });
    } else if (req.url().endsWith("/submit"))
      await r.fulfill({
        json: {
          data: {
            ...attempt,
            status: "submitted",
            raw_score: 1,
            total_points: 1,
            band: null,
          },
        },
      });
    else await r.fulfill({ json: { data: attempt } });
  });
  await page.goto("/practice/reading");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your answer 1" })
    .fill("Student answer");
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(writes.at(-1)).toEqual({
    answers: { [questionId]: "Student answer" },
  });
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Raw score: 1/1" }),
  ).toBeVisible();
});
test("writing autosaves, resumes and submits a stable draft identity", async ({
  page,
}) => {
  const taskId = "60000000-0000-4000-8000-000000000001",
    draftId = "60000000-0000-4000-8000-000000000002";
  const task = {
    id: taskId,
    title: "Writing fixture",
    prompt: "Isolated writing test instructions",
    task_number: 2,
  };
  let saved = "";
  let submitted = false;
  await page.route("**/api/me", (r) =>
    r.fulfill({
      json: {
        data: {
          ...me,
          destination: "/dashboard",
          onboarding: { completed: true },
        },
      },
    }),
  );
  await page.route("**/api/catalog/writing_tasks*", (r) =>
    r.fulfill({ json: { data: [task] } }),
  );
  await page.route("**/api/writing", async (r) => {
    const p = r.request().postDataJSON();
    if (p.body !== undefined) {
      expect(p.submission_id).toBe(draftId);
      saved = p.body;
    }
    if (p.finish) submitted = true;
    await r.fulfill({
      json: {
        data: {
          id: draftId,
          task_id: taskId,
          body: saved,
          deadline: new Date(Date.now() + 600000).toISOString(),
          submitted_at: submitted ? new Date().toISOString() : null,
        },
      },
    });
  });
  await page.goto("/practice/writing");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your answer" })
    .fill("My actual response in this isolated browser test.");
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(saved).toContain("My actual response");
  await page.reload();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue(
    saved,
  );
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Awaiting evaluation/ }),
  ).toBeVisible();
  expect(submitted).toBe(true);
});
test("speaking records real browser audio and uses the signed-upload workflow", async ({
  page,
}) => {
  const taskId = "70000000-0000-4000-8000-000000000001";
  let uploaded = false,
    attached = false;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.context().grantPermissions(["microphone"]);
  await page.route("**/api/me", (r) =>
    r.fulfill({
      json: {
        data: {
          ...me,
          destination: "/dashboard",
          onboarding: { completed: true },
        },
      },
    }),
  );
  await page.route("**/api/catalog/speaking_tasks*", (r) =>
    r.fulfill({
      json: {
        data: [
          {
            id: taskId,
            title: "Speaking fixture",
            prompt: "Respond to an isolated test prompt.",
            part: 1,
            preparation_seconds: 0,
            response_seconds: 10,
          },
        ],
      },
    }),
  );
  await page.route("**/api/media-upload", (r) =>
    r.fulfill({
      json: {
        data: {
          signedUrl: "http://127.0.0.1:3000/fixture-audio-upload",
          path: "qa/recording.webm",
        },
      },
    }),
  );
  await page.route("**/fixture-audio-upload", async (r) => {
    expect(r.request().method()).toBe("PUT");
    const audio = r.request().postDataBuffer();
    expect(audio?.length).toBeGreaterThan(100);
    expect(audio?.subarray(0, 4)).toEqual(Buffer.from([26, 69, 223, 163]));
    uploaded = true;
    await r.fulfill({ json: { Key: "qa/recording.webm" } });
  });
  await page.route("**/api/media-finalize", (r) =>
    r.fulfill({ json: { data: { path: "qa/recording.webm" } } }),
  );
  await page.route("**/api/speaking", async (r) => {
    expect(r.request().postDataJSON()).toEqual({
      task_id: taskId,
      path: "qa/recording.webm",
    });
    attached = true;
    await r.fulfill({ json: { data: { id: "recording-fixture" } } });
  });
  await page.goto("/practice/speaking");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page
    .getByRole("button", { name: "Record response", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(600);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(page.locator("audio")).toBeVisible();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved" }),
  ).toBeVisible();
  expect(uploaded).toBe(true);
  expect(attached).toBe(true);
  await page.locator('.sidebar a[href="/progress"]').click();
  await expect(
    page.getByRole("heading", { name: "Results", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
