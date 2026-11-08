"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { translate, type Language } from "@/lib/i18n";
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  return () => observer.disconnect();
}
export function SystemMessage({
  code,
  reset,
}: {
  code: string;
  reset?: () => void;
}) {
  const lang = useSyncExternalStore(
    subscribe,
    () => document.documentElement.lang as Language,
    () => "en" as Language,
  );
  return (
    <main className="not-found">
      <p className="eyebrow">IELTS ACADEMY</p>
      <h1>{translate(lang, code)}</h1>
      {reset && (
        <button className="button primary" onClick={reset}>
          {translate(lang, "retry")}
        </button>
      )}
      <Link className="button outline" href="/dashboard">
        {translate(lang, "dashboard")}
      </Link>
    </main>
  );
}
