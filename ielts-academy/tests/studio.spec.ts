import { test, expect } from "@playwright/test";
test("teacher skill builder uploads a computer file and creates a real API-shaped draft", async ({
  page,
}) => {
  const rows: Record<string, unknown>[] = [];
  let uploaded = false;
  await page.route("**/api/**", async (r) => {
    const p = new URL(r.request().url()).pathname.slice(5);
    let data: unknown = [];
    if (p === "submissions") data = { writing: [], speaking: [] };
    if (p === "dashboard") data = { assignments: [] };
    if (p === "me")
      data = {
        id: "10000000-0000-4000-8000-000000000001",
        email: "teacher@example.test",
        profile: { display_name: "Teacher" },
        preferences: { language: "en", theme: "light", ai_consent: false },
        roles: ["STUDENT", "TEACHER"],
        onboarding: { completed: true },
        destination: "/teacher",
      };
    if (p === "admin/content/tests") {
      if (r.request().method() === "POST")
        rows.push({
          id: "20000000-0000-4000-8000-000000000001",
          ...r.request().postDataJSON(),
        });
      data = r.request().method() === "POST" ? rows.at(-1) : rows;
    }
    if (p === "media-upload")
      data = {
        signedUrl: "/fixture-upload",
        path: "10000000-0000-4000-8000-000000000001/audio.wav",
      };
    if (p === "media-finalize")
      data = { path: "10000000-0000-4000-8000-000000000001/audio.wav" };
    if (p === "media-url") data = { signedUrl: "/fixture-file" };
    await r.fulfill({ json: { data } });
  });
  await page.route("**/fixture-upload", async (r) => {
    uploaded = !!r.request().postDataBuffer()?.length;
    await r.fulfill({ json: { data: true } });
  });
  await page.goto("/teacher");
  await page
    .locator(".skill-grid")
    .getByRole("button", { name: "Listening", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Add Test", exact: true }).click();
  const builder = page
    .locator("form")
    .filter({ has: page.locator("#content-builder") });
  await builder
    .getByLabel("Title", { exact: true })
    .fill("Listening upload draft");
  await builder.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => rows.length).toBe(1);
  expect(rows[0].skill).toBe("listening");
  expect(rows[0].status).toBe("draft");
  await page
    .locator("select")
    .filter({ has: page.locator('option[value="test_sections"]') })
    .selectOption("test_sections");
  const wave = Buffer.alloc(44);
  wave.write("RIFF");
  wave.write("WAVE", 8);
  await builder
    .getByLabel("Choose attachment", { exact: true })
    .setInputFiles({ name: "audio.wav", mimeType: "audio/wav", buffer: wave });
  await expect.poll(() => uploaded).toBe(true);
  await expect(
    builder.getByRole("link", { name: "Preview attachment" }),
  ).toBeVisible();
  await builder.getByRole("button", { name: "Remove attachment" }).click();
  await expect(
    builder.getByRole("link", { name: "Preview attachment" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "+ Add Test", exact: true }).click();
  await expect(
    page
      .locator("select")
      .filter({ has: page.locator('option[value="test_sections"]') }),
  ).toHaveValue("tests");
});
