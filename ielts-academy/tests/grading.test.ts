import { describe, it, expect } from "vitest";
import { grade, normalize, wordCount } from "../src/lib/grading";
import { readingQuestions, listeningQuestions } from "../src/data/content";
describe("deterministic sample grading", () => {
  it("checks every original reading question against its answer key", () => {
    const result = grade(
      readingQuestions,
      Object.fromEntries(readingQuestions.map((q) => [q.id, q.answer])),
    );
    expect(result).toEqual({ score: 7, total: 7, band: 9 });
  });
  it("does not give credit for missing or incorrect answers", () => {
    expect(grade(listeningQuestions, { l1: "wrong" })).toEqual({
      score: 0,
      total: 7,
      band: 0,
    });
  });
  it("compares trimmed case-insensitive answers", () => {
    expect(
      grade(readingQuestions, { r1: " FALSE. ", r6: "saturday" }).score,
    ).toBe(2);
  });
  it("preserves meaningful differences rather than fuzzy-matching wrong answers", () => {
    expect(normalize("Not Given")).not.toBe(normalize("No"));
    expect(grade(readingQuestions, { r6: "Saturdays" }).score).toBe(0);
  });
  it("returns a partial score and illustrative band", () => {
    expect(
      grade(listeningQuestions, { l1: "9", l2: "20", l3: "Library" }),
    ).toEqual({ score: 3, total: 7, band: 5 });
  });
});
describe("writing count", () => {
  it("counts words without formatting markup or whitespace artifacts", () => {
    expect(wordCount("<p>Hello <b>world</b></p>\nAnother thought.")).toBe(4);
    expect(wordCount("  ")).toBe(0);
  });
});
