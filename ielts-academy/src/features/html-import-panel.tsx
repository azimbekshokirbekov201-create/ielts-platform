"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./academy-context";

type Summary = {
  skill: string;
  detected_title: string;
  parts: number;
  questions: number;
  options: number;
  answers: number;
  warnings: string[];
  test_id: string | null;
};
const MAX_BYTES = 8_000_000;

export function ImportPanel({ onOpenContent }: { onOpenContent: () => void }) {
  const { t, run, notify } = useApp();
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [skill, setSkill] = useState("");
  const [variant, setVariant] = useState("academic");
  const [tier, setTier] = useState("premium");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const body = (dry_run: boolean, source = html) => ({
    html: source,
    title: title || "Imported test",
    ...(skill ? { skill } : {}),
    variant,
    access_tier: tier,
    dry_run,
  });
  async function check(source: string, name: string) {
    setBusy(true);
    setSummary(null);
    setDone(false);
    await run(async () => {
      const result = await api<Summary>(
        "admin/import-html",
        "POST",
        body(true, source),
      );
      setSummary(result);
      setTitle(
        (t0) =>
          t0 ||
          result.detected_title ||
          name.replace(/\.html?$/i, "").slice(0, 200),
      );
    });
    setBusy(false);
  }
  const warning = (w: string) => {
    const [code, n] = w.split(":");
    return t(code) + (n ? ": " + n : "");
  };
  return (
    <section className="card form-stack">
      <h2>{t("import_html")}</h2>
      <p>{t("import_hint")}</p>
      <label className="field">
        {t("import_file")}
        <input
          className="input"
          type="file"
          accept=".html,.htm,text/html"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_BYTES) {
              notify("too_large");
              return;
            }
            void file.text().then((text) => {
              setHtml(text);
              void check(text, file.name);
            });
          }}
        />
      </label>
      {busy && <p role="status">{t("import_checking")}</p>}
      {summary && (
        <>
          <div className="card">
            <h3>{t("import_found")}</h3>
            <p>
              {t("import_skill")}: {t(summary.skill)} · {t("import_parts")}:{" "}
              {summary.parts} · {t("import_questions")}: {summary.questions} ·{" "}
              {t("import_options")}: {summary.options} · {t("import_answers")}:{" "}
              {summary.answers}
            </p>
            {summary.warnings.map((w) => (
              <p className="notice" key={w}>
                {warning(w)}
              </p>
            ))}
          </div>
          <label className="field">
            {t("title")}
            <input
              className="input"
              value={title}
              maxLength={200}
              required
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            {t("import_skill")}
            <select
              className="input"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
            >
              <option value="">{t("import_auto")}</option>
              <option value="reading">{t("reading")}</option>
              <option value="listening">{t("listening")}</option>
            </select>
          </label>
          <label className="field">
            {t("variant")}
            <select
              className="input"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
            >
              {["academic", "general"].map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t("access_tier")}
            <select
              className="input"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              {["free", "premium"].map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          {done ? (
            <div role="status">
              <p>{t("import_done")}</p>
              <button className="button primary" onClick={onOpenContent}>
                {t("import_open")}
              </button>
            </div>
          ) : (
            <button
              className="button primary"
              disabled={busy || !title.trim()}
              onClick={() => {
                setBusy(true);
                void run(async () => {
                  await api("admin/import-html", "POST", body(false));
                  notify("saved");
                  setDone(true);
                }).finally(() => setBusy(false));
              }}
            >
              {t(busy ? "saving" : "import_start")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
