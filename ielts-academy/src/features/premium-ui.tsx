"use client";
import {
  BookOpen,
  Headphones,
  PenLine,
  Mic,
  ClipboardList,
} from "lucide-react";
import { useApp } from "./academy-context";
import type { Row } from "@/lib/api";
export const learningSkills = [
  {
    id: "listening",
    title: "Listening",
    color: "blue",
    icon: Headphones,
    description: "Tune in. Understand more. Build confidence.",
  },
  {
    id: "reading",
    title: "Reading",
    color: "purple",
    icon: BookOpen,
    description: "Read with purpose and find the details that matter.",
  },
  {
    id: "writing",
    title: "Writing",
    color: "orange",
    icon: PenLine,
    description: "Find your words. Shape your ideas with clarity.",
  },
  {
    id: "speaking",
    title: "Speaking",
    color: "green",
    icon: Mic,
    description: "Make yourself heard, one conversation at a time.",
  },
] as const;
export function LanguageControl() {
  const { lang, setLang, t } = useApp();
  return (
    <select
      className="language-button"
      aria-label={t("language")}
      value={lang}
      onChange={(e) => setLang(e.target.value as typeof lang)}
    >
      <option value="en">English</option>
      <option value="uz">O‘zbekcha</option>
      <option value="ru">Русский</option>
    </select>
  );
}
export function LearningHeading({ skill }: { skill: string }) {
  const { t } = useApp();
  const s = learningSkills.find((x) => x.id === skill);
  const Icon = s?.icon || ClipboardList;
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span className="tiny-line" /> A LITTLE PRACTICE. A BIG POSSIBILITY.
        </div>
        <h1>{t(skill)}</h1>
        <p>
          {s?.description ||
            "All four skills. One focused space to see how far you have come."}
        </p>
      </div>
      <span className={`skill-icon large ${s?.color || "blue"}`}>
        <Icon size={28} />
      </span>
    </div>
  );
}
export function evaluatedBand(evaluations: Row[]): number | null {
  const sorted = [...evaluations]
    .filter((x) => typeof x.band === "number")
    .sort(
      (a, b) =>
        Number(b.source === "teacher") - Number(a.source === "teacher") ||
        String(b.created_at).localeCompare(String(a.created_at)),
    );
  return sorted.length ? Number(sorted[0].band) : null;
}
export function learningScores(
  attempts: Row[],
  submissions: { writing: Row[]; speaking: Row[] },
) {
  const rows: { id: string; skill: string; band: number; date: string }[] = [];
  for (const a of attempts)
    if (a.status === "submitted" && typeof a.band === "number")
      rows.push({
        id: a.id,
        skill: String((a.tests as Row)?.skill),
        band: a.band,
        date: String(a.submitted_at),
      });
  for (const skill of ["writing", "speaking"] as const)
    for (const a of submissions[skill]) {
      const band = evaluatedBand((a[skill + "_evaluations"] as Row[]) || []);
      if (band !== null)
        rows.push({
          id: a.id,
          skill,
          band,
          date: String(a.submitted_at || a.created_at),
        });
    }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
