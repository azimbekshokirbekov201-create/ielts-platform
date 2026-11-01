import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const route of [
  "/",
  "/dashboard",
  "/login",
  "/practice/reading",
  "/practice/writing",
  "/practice/speaking",
  "/courses",
  "/settings",
])
  test(`accessible structure ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForTimeout(1000);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .exclude('[aria-hidden="true"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });

test("dark dashboard retains readable contrast and accessible structure", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.waitForTimeout(1000);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude('[aria-hidden="true"]')
    .analyze();
  expect(results.violations).toEqual([]);
});
