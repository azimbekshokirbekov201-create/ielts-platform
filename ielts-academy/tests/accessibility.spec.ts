import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const route of ["/", "/login", "/register", "/forgot-password"])
  test(`accessible ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole("heading").first().waitFor();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
