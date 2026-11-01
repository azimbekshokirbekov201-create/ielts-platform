import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page, role = "Student") {
  await page.goto("/login");
  await page
    .getByRole("button", { name: role.toLowerCase(), exact: true })
    .click();
  await expect(page).toHaveURL(
    role === "Student" ? /dashboard/ : new RegExp(role.toLowerCase()),
  );
}
test("landing navigation, FAQ, free plan and plan preview work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your ambition/ }),
  ).toBeVisible();
  await page
    .getByText("Is this an official IELTS platform?", { exact: true })
    .click();
  await expect(page.getByText(/not affiliated with or endorsed/)).toBeVisible();
  await page.getByRole("button", { name: "View plan preview" }).click();
  await expect(page.getByRole("dialog")).toContainText("no checkout");
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Explore the demo", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/dashboard/);
});
test("login form validates, local session persists and no password is stored", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect(
    page.getByText("Enter a valid email address.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Use at least 8 characters.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("learner@example.com");
  await page
    .getByLabel("Password (UI only — not stored)", { exact: true })
    .fill("demo-pass-123");
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Good morning, learner/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("ielts-academy-v1")),
  ).not.toContain("demo-pass-123");
});
test("registration and recovery flows are explicitly demo-only", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Taylor Demo");
  await page.getByLabel("Email address").fill("taylor@example.com");
  await page
    .getByLabel("Password (UI only — not stored)", { exact: true })
    .fill("sample123");
  await page.getByRole("button", { name: "Create local demo session" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("taylor@example.com");
  await page.getByRole("button", { name: "Preview recovery" }).click();
  await expect(page.getByRole("status")).toContainText(
    "No recovery email was sent",
  );
  await page.getByRole("link", { name: "Preview reset screen" }).click();
  await page.getByLabel("New password").fill("replacement123");
  await page.getByRole("button", { name: "Preview password reset" }).click();
  await expect(page.getByRole("status")).toContainText(
    "No password was changed",
  );
});
test("dashboard goals, search and navigation work", async ({ page }) => {
  await demo(page);
  await page.getByLabel("Read something new").check();
  await page.reload();
  await expect(page.getByLabel("Read something new")).toBeChecked();
  await page.getByRole("button", { name: "Search platform" }).click();
  await page.getByRole("textbox", { name: "Search pages" }).fill("writing");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Writing", exact: true })
    .click();
  await expect(page).toHaveURL(/practice\/writing/);
});
test("reading answers autosave and grade deterministically with explanations", async ({
  page,
}) => {
  await page.goto("/practice/reading");
  await page.getByRole("button", { name: "Begin practice" }).click();
  await page.getByLabel("False", { exact: true }).check();
  await page.getByLabel("Yes", { exact: true }).check();
  await page.getByLabel("To learn practical skills", { exact: true }).check();
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).click();
  await expect(page.getByLabel("False", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Section 2", exact: true }).click();
  await page.getByLabel("Learning by growing", { exact: true }).check();
  await page.getByLabel("3", { exact: true }).check();
  await page.getByRole("button", { name: "Section 3", exact: true }).click();
  await page.locator("#r6").fill("Saturday");
  await page.locator("#r7").fill("rainwater");
  await page.getByRole("button", { name: "Submit answers" }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByText("7 of 7 correct")).toBeVisible();
  await expect(
    page.getByText(
      "The council provided land, while residents paid for tools.",
    ),
  ).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("7/7 correct")).toBeVisible();
});
test("listening audio plays, seeks and pauses; all four sections submit", async ({
  page,
}) => {
  await page.goto("/practice/listening");
  await page.getByRole("button", { name: "Begin practice" }).click();
  await page.getByRole("button", { name: "Play audio", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause audio" })).toBeVisible();
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause audio" }).click();
  await page.locator("#l1").fill("9");
  await page.locator("#l2").fill("20");
  await page.getByRole("button", { name: "Section 2", exact: true }).click();
  await page.getByLabel("Library", { exact: true }).check();
  await page.getByLabel("East", { exact: true }).check();
  await page.getByRole("button", { name: "Section 3", exact: true }).click();
  await page.getByLabel("Interviews", { exact: true }).check();
  await page.getByRole("button", { name: "Section 4", exact: true }).click();
  await page.locator("#l6").fill("Saturday");
  await page.locator("#l7").fill("food");
  await page.getByRole("button", { name: "Submit answers" }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByText("7 of 7 correct")).toBeVisible();
});
test("writing draft survives reload, timer runs and submission awaits evaluation", async ({
  page,
}) => {
  await page.goto("/practice/writing");
  const editor = page.getByRole("textbox", { name: "Your writing response" });
  await editor.fill(
    "Cities provide opportunities for work and education. However, rural areas offer a strong sense of community.",
  );
  await expect(page.getByText("16 / 250 words")).toBeVisible();
  await page.getByRole("button", { name: "Start timer" }).click();
  await expect(page.getByLabel("Time remaining")).toBeVisible();
  await page.reload();
  await expect(editor).toContainText("Cities provide opportunities");
  await page.getByRole("button", { name: "Submit writing" }).click();
  await page.getByRole("button", { name: "Save submission" }).click();
  await expect(
    page.getByRole("heading", { name: "Awaiting evaluation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore explicitly labeled demo feedback" })
    .click();
  await expect(
    page.getByText("DEMO FEEDBACK · FIXED EXAMPLE", { exact: true }),
  ).toBeVisible();
});
test("speaking records original browser audio, replays and persists history", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.goto("/practice/speaking");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByRole("link", { name: "Download recording" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save practice session" }).click();
  await expect(
    page.getByRole("button", { name: "Saved · Awaiting evaluation" }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Replay", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(page.locator("audio")).toBeVisible();
});
test("speaking microphone denial is explained", async ({ page, context }) => {
  await context.grantPermissions([]);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  await page.goto("/practice/speaking");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Microphone permission was denied" }),
  ).toBeVisible();
});
test("course enrollment, lesson quiz and completion persist", async ({
  page,
}) => {
  await page.goto("/courses");
  await page
    .getByRole("button", { name: "Explore course", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Enroll in demo course" }).click();
  await page
    .getByLabel("Identify the task, instructions, and word limit", {
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Check understanding" }).click();
  await page.getByRole("button", { name: "Complete & continue" }).click();
  await expect(page.getByText("1 of 8 lessons complete")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue course" }).first().click();
  await expect(page.getByText("1 of 8 lessons complete")).toBeVisible();
});
test("teacher assignment CRUD and essay feedback are persistent", async ({
  page,
}) => {
  await demo(page, "Teacher");
  await page.getByRole("button", { name: "Assignments", exact: true }).click();
  await page
    .getByRole("button", { name: "Add assignment", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Practice for Friday");
  await page
    .getByRole("textbox", { name: "Details", exact: true })
    .fill("Writing Task 2 · Friday");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByRole("cell", { name: "Practice for Friday", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Assignments", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Practice for Friday", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reviews", exact: true }).click();
  await page
    .getByRole("button", { name: "Review", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Teacher feedback" })
    .fill("Clear main idea. Develop one concrete example.");
  await page.getByRole("button", { name: "Save feedback locally" }).click();
  await expect(page.getByText("Reviewed", { exact: true })).toBeVisible();
});
test("admin CRUD can add, edit, search and delete a user", async ({ page }) => {
  await demo(page, "Admin");
  await page.getByRole("button", { name: "Add user", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Test Learner");
  await page
    .getByRole("textbox", { name: "Details", exact: true })
    .fill("Local record");
  await page.getByRole("button", { name: "Save record" }).click();
  await page
    .getByRole("button", { name: "Edit Test Learner", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Updated Learner");
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("textbox", { name: "Search users" }).fill("Updated");
  await expect(
    page.getByRole("cell", { name: "Updated Learner", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete Updated Learner" }).click();
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page.getByText("Room for something new")).toBeVisible();
});
test("theme, language and goals persist", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Interface language", exact: true })
    .selectOption("uz");
  await page
    .getByRole("combobox", { name: "Target band", exact: true })
    .selectOption("8");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "uz");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Xayrli tong/ }),
  ).toBeVisible();
  await expect(
    page.locator(".summary-number").filter({ hasText: "Band 8.0" }),
  ).toBeVisible();
});
test("sample mock prevents unfinished progression and runs all four skills", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.goto("/mock-exams");
  await page.getByRole("button", { name: "Begin sample exam" }).click();
  await expect(
    page.getByRole("button", { name: "Next: Reading" }),
  ).toBeDisabled();
  for (const next of ["Reading", "Writing"]) {
    await page.getByRole("button", { name: "Submit answers" }).click();
    await page.getByRole("button", { name: "Confirm submission" }).click();
    await page
      .getByRole("button", { name: `Next: ${next}`, exact: true })
      .click();
  }
  await page
    .getByRole("textbox", { name: "Your writing response" })
    .fill("This is an original response for the sample exam.");
  await page.getByRole("button", { name: "Submit writing" }).click();
  await page.getByRole("button", { name: "Save submission" }).click();
  await page.getByRole("button", { name: "Next: Speaking" }).click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: "Save practice session" }).click();
  await page.getByRole("button", { name: "Finish sample exam" }).click();
  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await expect(
    page.getByRole("heading", { name: "Sample exam saved" }),
  ).toBeVisible();
  await expect(page.getByText("No overall band is calculated")).toBeVisible();
});
for (const width of [320, 375, 430, 768, 1024, 1440, 1920])
  test(`responsive pages at ${width}px have no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/dashboard",
      "/practice/reading",
      "/practice/writing",
      "/practice/speaking",
      "/mock-exams",
      "/courses",
      "/progress",
      "/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${route} overflow at ${width}`,
      ).toBe(true);
    }
    if (width < 701) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Reading", exact: true })
        .click();
      await expect(page).toHaveURL(/practice\/reading/);
      await expect(
        page
          .getByRole("button", { name: "Close navigation", exact: true })
          .last(),
      ).not.toBeInViewport();
    }
  });
