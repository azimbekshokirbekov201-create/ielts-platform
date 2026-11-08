import { describe, it, expect } from "vitest";
import {
  onboardingSchema,
  evaluationSchema,
  speakingFeedbackSchema,
  contentSchemas,
  roleDestination,
  bandAverage,
} from "@/server/validation";
import { allTranslations } from "@/lib/i18n";
import { matchesFileType } from "@/server/uploads";
describe("input boundaries", () => {
  it("rejects invalid onboarding values and client supplied completion", () => {
    for (const input of [
      { target_band: 7.2 },
      { priority_skills: ["math"] },
      { weekly_availability: [8] },
      { daily_goal_minutes: 0 },
      { completed: true },
    ])
      expect(onboardingSchema.safeParse(input).success).toBe(false);
  });
  it("accepts stable language-independent internal choices", () => {
    expect(
      onboardingSchema.parse({
        motivation: "career",
        target_band: 7.5,
        current_level: "unknown",
        priority_skills: ["speaking"],
        weekly_availability: [1, 7],
      }).target_band,
    ).toBe(7.5);
  });
  it("routes privileged roles before onboarding and resumes students", () => {
    expect(roleDestination(["STUDENT", "ADMIN"], false)).toBe("/admin");
    expect(roleDestination(["TEACHER"], false)).toBe("/teacher");
    expect(roleDestination(["STUDENT"], false)).toBe("/onboarding");
    expect(roleDestination(["STUDENT"], true)).toBe("/dashboard");
  });
  it("rejects invalid AI scores and fabricated response shapes", () => {
    expect(
      evaluationSchema.safeParse({ band: 9, feedback: "great" }).success,
    ).toBe(false);
    expect(
      evaluationSchema.safeParse({
        criteria: { task_response: 10, coherence: 8, lexical: 8, grammar: 8 },
        feedback: "x",
        grammar_feedback: "x",
        vocabulary_feedback: "x",
        improvements: ["x"],
      }).success,
    ).toBe(false);
    expect(
      speakingFeedbackSchema.safeParse({
        feedback: "x",
        improvements: ["x"],
        pronunciation: 9,
      }).success,
    ).toBe(false);
  });
  it("validates complete structured AI writing feedback", () => {
    const r = evaluationSchema.parse({
      criteria: { task_response: 7, coherence: 6.5, lexical: 7.5, grammar: 7 },
      feedback: "Estimate",
      grammar_feedback: "Agreement",
      vocabulary_feedback: "Precision",
      improvements: ["Revise"],
    });
    expect(bandAverage(Object.values(r.criteria))).toBe(7);
  });
  it("rejects unsafe URLs and invalid test timing", () => {
    expect(
      contentSchemas.lessons.safeParse({
        module_id: crypto.randomUUID(),
        title: "Test",
        body: "text",
        video_url: "javascript://alert(1)",
      }).success,
    ).toBe(false);
    expect(
      contentSchemas.tests.safeParse({
        title: "T",
        skill: "reading",
        duration_seconds: -1,
      }).success,
    ).toBe(false);
  });
  it("does not accept a disguised HTML upload", () => {
    expect(
      matchesFileType(
        "image/png",
        new TextEncoder().encode("<script>alert(1)"),
      ),
    ).toBe(false);
    expect(
      matchesFileType("audio/webm", new Uint8Array([26, 69, 223, 163])),
    ).toBe(true);
  });
  it("has all three nonempty translations for every active interface key", () => {
    for (const values of Object.values(allTranslations())) {
      expect(values).toHaveLength(3);
      values.forEach((v) => expect(v.trim().length).toBeGreaterThan(0));
    }
  });
});
