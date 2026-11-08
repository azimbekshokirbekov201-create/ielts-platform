"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Compass, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "./academy-context";
const keys = [
  "welcome",
  "motivation",
  "target_band",
  "current_level",
  "priority_skills",
  "daily_goal_minutes",
  "weekly_availability",
  "summary",
  "completion",
];
const choices: Record<number, (string | number)[]> = {
  1: [
    "study_abroad",
    "university",
    "career",
    "immigration",
    "personal",
    "other",
  ],
  2: [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9],
  3: [
    "beginner",
    "elementary",
    "intermediate",
    "upper_intermediate",
    "advanced",
    "unknown",
  ],
  4: ["listening", "reading", "writing", "speaking"],
  5: [10, 20, 30, 45, 60],
  6: [1, 2, 3, 4, 5, 6, 7],
};
export function Onboarding() {
  const { me, t, run, refresh } = useApp();
  const [step, setStep] = useState(Number(me?.onboarding?.current_step || 0));
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    me?.onboarding || {},
  );
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const key = keys[step],
    multi = step === 4 || step === 6;
  const valid =
    step === 0 ||
    step >= 7 ||
    (multi
      ? Array.isArray(answers[key]) && (answers[key] as unknown[]).length > 0
      : !!answers[key]);
  function choose(value: string | number) {
    setAnswers((a) => ({
      ...a,
      [key]: multi
        ? ((a[key] as unknown[]) || []).includes(value)
          ? (a[key] as unknown[]).filter((x) => x !== value)
          : [...((a[key] as unknown[]) || []), value]
        : value,
    }));
  }
  async function advance() {
    setBusy(true);
    await run(async () => {
      const payload = Object.fromEntries(
        keys
          .slice(1, 7)
          .filter((k) => answers[k] !== undefined && answers[k] !== null)
          .map((k) => [k, answers[k]]),
      );
      await api("onboarding", "PATCH", {
        answers: { ...payload, current_step: Math.min(step + 1, 8) },
        finish: step === 8,
      });
      if (step === 8) {
        setDone(true);
        await refresh();
      } else setStep(step + 1);
    });
    setBusy(false);
  }
  return (
    <section className="live-onboarding card">
      <div
        className="live-onboard-progress"
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={done ? 100 : Math.round((step / 8) * 100)}
      >
        <span style={{ width: `${done ? 100 : (step / 8) * 100}%` }} />
      </div>
      <div
        className={`live-onboard-art ${done ? "celebrate" : ""}`}
        aria-hidden="true"
      >
        {done ? <Sparkles size={62} /> : <Compass size={62} />}
        <i>✦</i>
        <b>✧</b>
      </div>
      <h1>{t(done ? "completion" : key)}</h1>
      {step === 0 && <p>{t("subtitle")}</p>}
      {step === 3 && <p>{t("self_report")}</p>}
      {choices[step] && (
        <div className="live-choices">
          {choices[step].map((value) => {
            const selected = multi
              ? ((answers[key] as unknown[]) || []).includes(value)
              : answers[key] === value;
            return (
              <button
                key={value}
                aria-pressed={selected}
                className={`live-choice ${selected ? "selected" : ""}`}
                onClick={() => choose(value)}
              >
                {step === 6
                  ? t("day" + value)
                  : typeof value === "number"
                    ? value
                    : t(value)}
                {selected && <Check size={18} />}
              </button>
            );
          })}
        </div>
      )}
      {step === 5 && (
        <label className="field">
          {t("daily_goal_minutes")}
          <input
            className="input"
            type="number"
            min={5}
            max={240}
            value={Number(answers.daily_goal_minutes) || ""}
            onChange={(e) => choose(Number(e.target.value))}
          />
        </label>
      )}
      {step === 7 && (
        <dl className="live-summary">
          {keys.slice(1, 7).map((k) => (
            <div key={k}>
              <dt>{t(k)}</dt>
              <dd>
                {Array.isArray(answers[k])
                  ? (answers[k] as (string | number)[])
                      .map((v) =>
                        k === "weekly_availability"
                          ? t("day" + v)
                          : t(String(v)),
                      )
                      .join(", ")
                  : typeof answers[k] === "number"
                    ? String(answers[k])
                    : t(String(answers[k]))}{" "}
                <button
                  className="text-link"
                  onClick={() => setStep(keys.indexOf(k))}
                >
                  {t("edit")}
                </button>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {step === 8 && <p className="onboarding-badge">✦ {t("badge")}</p>}
      <div className="live-actions">
        {done ? (
          <Link className="button primary" href="/dashboard">
            {t("dashboard")}
            <ArrowRight size={18} />
          </Link>
        ) : (
          <>
            {step > 0 && (
              <button
                className="button outline"
                disabled={busy}
                onClick={() => setStep(step - 1)}
              >
                {t("back")}
              </button>
            )}
            <button
              className="button primary"
              disabled={busy || !valid}
              onClick={() => void advance()}
            >
              {t(
                busy
                  ? "saving"
                  : step === 0
                    ? "start"
                    : step === 8
                      ? "finish"
                      : "next",
              )}
              <ArrowRight size={18} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
