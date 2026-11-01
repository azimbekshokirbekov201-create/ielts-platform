"use client";
import Link from "next/link";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="not-found">
      <p className="eyebrow">A MOMENT TO RESET</p>
      <h1>Something interrupted your session.</h1>
      <p>
        Your locally saved work may still be available. Try loading this
        workspace again.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <Link className="text-link" href="/dashboard">
        Return to dashboard
      </Link>
    </main>
  );
}
