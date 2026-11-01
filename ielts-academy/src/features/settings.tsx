"use client";
import { useState } from "react";
import { Toast } from "@/components/ui/toast";
import { Check, Sun, Moon, Download, ShieldCheck } from "lucide-react";
import { useAcademy } from "@/store/use-academy";
import { translations } from "@/data/content";
import { Card, Input, Badge } from "@/components/ui/primitives";
export function Settings() {
  const store = useAcademy();
  const t = translations[store.lang];
  const [name, setName] = useState(store.session?.name ?? "Alex Morgan");
  const [saved, setSaved] = useState(false);
  function exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      attempts: store.attempts,
      drafts: store.drafts,
      answers: store.answers,
      enrolled: store.enrolled,
      completed: store.completed,
      goals: store.goals,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ielts-academy-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE YOURSELF AT HOME</div>
          <h1>{t.settings}</h1>
          <p>A workspace that feels a little more like you.</p>
        </div>
        <Badge color="slate">LOCAL PREFERENCES</Badge>
      </div>
      <div className="settings-layout">
        <Card>
          <h2>Your profile</h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              store.login(
                name,
                store.session?.email ?? "alex@example.com",
                store.session?.role ?? "student",
              );
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            }}
          >
            <label className="field">
              Display name
              <Input
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              Demo email
              <Input
                readOnly
                value={store.session?.email ?? "alex@example.com"}
              />
            </label>
            <button type="submit" className="button primary">
              <Check size={16} />
              {saved ? "Saved" : t.save}
            </button>
            {saved && (
              <Toast
                message="Your profile is saved in this browser."
                onDismiss={() => setSaved(false)}
              />
            )}
          </form>
        </Card>
        <Card>
          <h2>{t.theme}</h2>
          <div className="theme-options">
            {(["light", "dark"] as const).map((theme) => (
              <button
                className={store.theme === theme ? "selected" : ""}
                aria-pressed={store.theme === theme}
                key={theme}
                onClick={() => store.preferences({ theme })}
              >
                {theme === "light" ? <Sun /> : <Moon />}
                {theme === "light" ? "Light" : "Dark"}
                {store.theme === theme && <Check size={15} />}
              </button>
            ))}
          </div>
          <label className="field">
            {t.language}
            <select
              className="input"
              value={store.lang}
              onChange={(e) =>
                store.preferences({
                  lang: e.target.value as "en" | "uz" | "ru",
                })
              }
            >
              <option value="en">English</option>
              <option value="uz">O‘zbekcha</option>
              <option value="ru">Русский</option>
            </select>
          </label>
          <p className="caption">
            Navigation, dashboard headings, and preferences are translated.
            Practice content and detailed learning material remain in English
            for IELTS preparation.
          </p>
        </Card>
        <Card>
          <h2>Your next milestone</h2>
          <label className="field">
            Target band
            <select
              className="input"
              value={store.target}
              onChange={(e) =>
                store.preferences({ target: Number(e.target.value) })
              }
            >
              {[4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((b) => (
                <option key={b} value={b}>
                  Band {b.toFixed(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Daily practice goal
            <select
              className="input"
              value={store.goal}
              onChange={(e) =>
                store.preferences({ goal: Number(e.target.value) })
              }
            >
              {[15, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
          <p className="notice">
            Goals are personal intentions. They do not guarantee an exam result.
          </p>
        </Card>
        <Card>
          <ShieldCheck size={26} className="text-blue" />
          <h2>Your data, on your device.</h2>
          <p>
            This frontend demo stores session preferences, drafts, and results
            in localStorage. Recordings are stored in IndexedDB. No backend,
            secure authentication, payment gateway, or paid AI service is
            connected.
          </p>
          <button className="button outline" onClick={exportData}>
            <Download size={16} />
            Export local progress
          </button>
          <p className="caption">
            Recordings are downloaded separately in the Speaking workspace.
            Clearing browser storage removes local progress.
          </p>
        </Card>
      </div>
    </>
  );
}
