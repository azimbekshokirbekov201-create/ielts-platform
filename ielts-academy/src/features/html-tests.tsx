"use client";
import { useState } from "react";
import { api, type Row } from "@/lib/api";
import { useApp } from "./academy-context";
import { Catalog } from "./learning-rooms";

/**
 * HTML exam pages uploaded by teachers run inside a sandboxed frame: scripts work, but the page
 * has no access to the platform's session, cookies or API.
 */
export function HtmlTests() {
  const { t, run } = useApp();
  const [open, setOpen] = useState<{ title: string; url: string } | null>(null);
  if (open)
    return (
      <div className="premium-learning">
        <div className="live-actions">
          <h1>{open.title}</h1>
          <button className="button outline" onClick={() => setOpen(null)}>
            {t("back")}
          </button>
        </div>
        <iframe
          title={open.title}
          src={open.url}
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
          referrerPolicy="no-referrer"
          style={{
            width: "100%",
            height: "82vh",
            border: "1px solid var(--border, #ddd)",
            borderRadius: 12,
            background: "#fff",
          }}
        />
      </div>
    );
  return (
    <div className="premium-learning">
      <h1>{t("html_tests")}</h1>
      <p>{t("html_tests_hint")}</p>
      <Catalog
        kind="html_tests"
        onSelect={(row: Row) =>
          void run(async () => {
            const link = await api<{ signedUrl: string }>("media-url", "POST", {
              bucket: "course-media",
              path: row.html_path,
            });
            setOpen({ title: String(row.title), url: link.signedUrl });
          })
        }
      />
    </div>
  );
}
