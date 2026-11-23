import type { Question } from "@/types";
export function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ");
}
export function grade(questions: Question[], answers: Record<string, string>) {
  const score = questions.filter(
    (q) => normalize(answers[q.id] ?? "") === normalize(q.answer),
  ).length;
  const ratio = score / questions.length;
  const band =
    ratio >= 0.98
      ? 9
      : ratio >= 0.9
        ? 8.5
        : ratio >= 0.8
          ? 8
          : ratio >= 0.7
            ? 7
            : ratio >= 0.6
              ? 6.5
              : ratio >= 0.5
                ? 6
                : ratio >= 0.4
                  ? 5
                  : ratio >= 0.3
                    ? 4.5
                    : ratio >= 0.2
                      ? 4
                      : ratio > 0
                        ? 3
                        : 0;
  return { score, total: questions.length, band };
}
export function wordCount(text: string) {
  return text
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

type BandTable = readonly (readonly [number, number])[];
const LISTENING: BandTable = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [32, 7.5],
  [30, 7],
  [26, 6.5],
  [23, 6],
  [18, 5.5],
  [16, 5],
  [13, 4.5],
  [10, 4],
  [8, 3.5],
  [6, 3],
  [4, 2.5],
  [3, 2],
  [1, 1],
  [0, 0],
];
const ACADEMIC_READING: BandTable = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [33, 7.5],
  [30, 7],
  [27, 6.5],
  [23, 6],
  [19, 5.5],
  [15, 5],
  [13, 4.5],
  [10, 4],
  [8, 3.5],
  [6, 3],
  [4, 2.5],
  [3, 2],
  [1, 1],
  [0, 0],
];
const GENERAL_READING: BandTable = [
  [40, 9],
  [39, 8.5],
  [37, 8],
  [36, 7.5],
  [34, 7],
  [32, 6.5],
  [30, 6],
  [27, 5.5],
  [23, 5],
  [19, 4.5],
  [15, 4],
  [12, 3.5],
  [9, 3],
  [6, 2.5],
  [3, 2],
  [1, 1],
  [0, 0],
];
/**
 * Estimated band used when a test has no custom band_thresholds. The score is scaled
 * to 40 questions first, so shorter or longer tests still get a sensible estimate.
 */
export function defaultBand(
  skill: string,
  variant: string,
  raw: number,
  total: number,
): number | null {
  if (!(total > 0) || (skill !== "listening" && skill !== "reading"))
    return null;
  const scaled = Math.round((Math.max(0, Math.min(raw, total)) / total) * 40);
  const table =
    skill === "listening"
      ? LISTENING
      : variant === "general"
        ? GENERAL_READING
        : ACADEMIC_READING;
  return table.find(([min]) => scaled >= min)?.[1] ?? 0;
}
