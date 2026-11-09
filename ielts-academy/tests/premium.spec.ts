import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const identity = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "learner@example.test",
  profile: { display_name: "Current learner" },
  preferences: { language: "en", theme: "light", ai_consent: false },
  roles: ["STUDENT"],
  onboarding: { completed: true, target_band: 7.5, daily_goal_minutes: 30 },
  destination: "/dashboard",
};
async function account(page: Page, role = "STUDENT", graded = false) {
  const me = structuredClone(identity);
  me.roles = role === "STUDENT" ? ["STUDENT"] : ["STUDENT", role];
  me.destination = role === "ADMIN" ? "/admin" : "/dashboard";
  const writes: { path: string; body: unknown }[] = [];
  await page.addInitScript(() =>
    localStorage.setItem(
      "ielts-academy-v1",
      JSON.stringify({
        state: { session: { name: "Alex Morgan", role: "admin" } },
        version: 1,
      }),
    ),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/", "");
    if (route.request().method() !== "GET") {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      if (path === "preferences") Object.assign(me.preferences, body);
      await route.fulfill({ json: { data: true } });
      return;
    }
    const attempts = graded
      ? [
          {
            id: "attempt-fixture",
            status: "submitted",
            raw_score: 1,
            total_points: 1,
            band: 6.5,
            submitted_at: "2026-11-09T08:00:00Z",
            tests: { title: "API reading result", skill: "reading" },
          },
        ]
      : [];
    const responses: Record<string, unknown> = {
      me,
      dashboard: {
        test_attempts: attempts,
        lesson_progress: [],
        course_enrollments: [],
        learning_activity_events: [],
        student_achievements: [],
        assignments: [],
      },
      attempts,
      submissions: { writing: [], speaking: [] },
      "mock-results": [],
      "admin/stats": { users: 1, students: 1, teachers: 0 },
      "admin/settings": {
        ai_enabled: false,
        ai_daily_user_limit: 5,
        ai_daily_platform_limit: 100,
      },
    };
    await route.fulfill({ json: { data: responses[path] ?? [] } });
  });
  return { writes, me };
}
test("original illustrated landing and split-screen authentication", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".landing-poster")).toBeVisible();
  await expect(page.locator(".landing-hero h1")).toContainText("Your ambition");
  await expect(page.locator(".marketing-course-grid")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("premium-landing.png"),
    fullPage: true,
  });
  await page.goto("/login");
  await expect(page.locator(".auth-brand-panel")).toBeVisible();
  await expect(page.locator(".auth-art")).toBeVisible();
  await expect(page.getByLabel(/Password/)).toHaveAttribute("minlength", "12");
  await expect(page.getByText("Demo role")).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("premium-auth.png"),
    fullPage: true,
  });
});
test("premium dashboard uses API identity and actual grades, with server-backed theme changes", async ({
  page,
}, info) => {
  const { writes } = await account(page, "STUDENT", true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/dashboard");
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".welcome-art")).toBeVisible();
  await expect(page.locator(".summary-grid")).toBeVisible();
  await expect(page.locator(".skill-grid .skill-card")).toHaveCount(4);
  await expect(page.locator(".sidebar-user")).toContainText("Current learner");
  await expect(
    page.getByText("API reading result", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".skill-card.purple .skill-score strong"),
  ).toHaveText("6.5");
  await expect(page.locator(".skill-card.blue .skill-score strong")).toHaveText(
    "—",
  );
  await expect(page.locator('.sidebar a[href="/admin"]')).toHaveCount(0);
  await expect(page.getByText("Alex Morgan")).toHaveCount(0);
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("premium-dashboard.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(writes).toContainEqual({
    path: "preferences",
    body: { theme: "dark" },
  });
  await page.screenshot({
    path: info.outputPath("premium-dashboard-dark.png"),
    fullPage: true,
  });
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", { name: "Search pages" }).fill("reading");
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Reading" }),
  ).toBeVisible();
});
test("original mobile sidebar opens without overflowing and keeps empty results honest", async ({
  page,
}, info) => {
  await account(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/dashboard");
  await expect(page.locator(".skill-score strong").first()).toHaveText("—");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".sidebar.mobile-open")).toBeVisible();
  await page.getByRole("link", { name: "Reading", exact: true }).click();
  await expect(page).toHaveURL(/practice\/reading/);
  await expect(page.locator(".sidebar.mobile-open")).toHaveCount(0);
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();
  await page.screenshot({
    path: info.outputPath("premium-mobile.png"),
    fullPage: true,
  });
});
test("administrator keeps the live content studio inside the original Shell", async ({
  page,
}) => {
  await account(page, "ADMIN");
  await page.goto("/admin");
  await expect(page.locator('.sidebar a[href="/admin"]')).toBeVisible();
  await expect(page.locator(".premium-workspace")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Administration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeVisible();
});
