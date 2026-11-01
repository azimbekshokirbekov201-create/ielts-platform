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
