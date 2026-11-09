"use client";
import { SubscriptionPanel } from "./subscriptions";
import Link from "next/link";
import { Sun, Moon, ShieldCheck } from "lucide-react";
import { Card, Badge } from "@/components/ui/primitives";
import { Preferences } from "./academy";
import { LanguageControl } from "./premium-ui";
import { useApp } from "./academy-context";
export function Settings() {
  const { me, t, theme, setTheme } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> MAKE YOURSELF AT HOME
          </div>
          <h1>{t("settings")}</h1>
          <p>A workspace that feels a little more like you.</p>
        </div>
        <Badge color="blue">YOUR PREFERENCES</Badge>
      </div>
      <div className="settings-layout premium-settings">
        <div>
          <Preferences hideHeading />
          <SubscriptionPanel />
        </div>
        <Card>
          <h2>Make it yours</h2>
          <p>Language and appearance are saved to your account.</p>
          <div className="live-actions">
            <LanguageControl />
          </div>
          <div className="live-actions">
            <button
              className={
                "button " + (theme === "light" ? "primary" : "outline")
              }
              onClick={() => void setTheme("light")}
            >
              <Sun size={17} />
              Light
            </button>
            <button
              className={"button " + (theme === "dark" ? "primary" : "outline")}
              onClick={() => void setTheme("dark")}
            >
              <Moon size={17} />
              Dark
            </button>
          </div>
          <h2>Your account</h2>
          <p>{me?.email}</p>
          <div className="live-actions">
            {me?.roles.map((role) => (
              <Badge color="slate" key={role}>
                {role}
              </Badge>
            ))}
          </div>
          <Link className="text-link" href="/reset-password">
            Change password →
          </Link>
          <div className="notice">
            <ShieldCheck size={18} />
            Your work stays connected to your account.
          </div>
        </Card>
      </div>
    </>
  );
}
