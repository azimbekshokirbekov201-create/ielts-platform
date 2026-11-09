"use client";
import Link from "next/link";
import { Brand } from "@/components/layout/shell";
import { AccountForm } from "./academy";
import { LanguageControl } from "./premium-ui";
export function Auth({ route }: { route: string }) {
  return (
    <div className="auth-layout">
      <div className="auth-brand-panel">
        <Brand />
        <div>
          <div className="hero-kicker">
            A LITTLE PRACTICE. A BIG POSSIBILITY.
          </div>
          <h1>
            Your ambition.
            <br />
            Your pace.
            <br />
            <em>Your next chapter.</em>
          </h1>
          <p>
            An intentional space to learn, practice, and grow into the
            confidence you’re looking for.
          </p>
          <div className="auth-art" aria-hidden="true">
            <span>Aa</span>
            <i>✦</i>
            <small>MAKE ROOM FOR YOUR POTENTIAL</small>
          </div>
        </div>
        <span className="caption">
          © 2026 IELTS Academy · Your next chapter
        </span>
      </div>
      <main className="auth-form-panel">
        <Link href="/" className="subtle-link auth-back">
          ← Back to home
        </Link>
        <div className="auth-form-wrap">
          <LanguageControl />
          <AccountForm route={route} />
        </div>
      </main>
    </div>
  );
}
