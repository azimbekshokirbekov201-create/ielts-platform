"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useState } from "react";
import { api, type Row } from "@/lib/api";
import { useApp, useResource, ResourceState } from "./academy-context";
export function SubscriptionPanel() {
  const { run, notify, t } = useApp();
  const r = useResource<Row>("subscription");
  return (
    <section className="card subscription-panel">
      <h2>{t("premium_access")}</h2>
      <ResourceState {...r}>
        <p>
          <strong>{String(r.data?.tier || "free").toUpperCase()}</strong> ·{" "}
          {String(r.data?.remaining_days || 0)} {t("days_remaining")}
        </p>
        {!!r.data?.activated_at && (
          <p>
            Activated:{" "}
            {new Date(String(r.data.activated_at)).toLocaleDateString()}
          </p>
        )}
        {!!r.data?.expires_at && (
          <p>
            Expires: {new Date(String(r.data.expires_at)).toLocaleDateString()}
          </p>
        )}
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const code = String(new FormData(e.currentTarget).get("code"));
            void run(async () => {
              await api("subscription/redeem", "POST", { code });
              await r.load();
              notify("saved");
            });
          }}
        >
          <label className="field">
            {t("promo_code")}
            <input
              name="code"
              className="input"
              minLength={8}
              maxLength={64}
              required
              autoComplete="off"
            />
          </label>
          <button className="button primary">{t("activate_premium")}</button>
        </form>
      </ResourceState>
    </section>
  );
}
export function SubscriptionManager() {
  const { run, notify } = useApp();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const r = useResource<{
    codes: Row[];
    subscriptions: Row[];
    redemptions: Row[];
  }>("admin/subscriptions");
  const users = useResource<Row[]>("admin/users");
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  async function mutate(path: string, body: unknown) {
    await run(async () => {
      await api("admin/subscriptions/" + path, "POST", body);
      await r.load();
      notify("saved");
    });
  }
  return (
    <section>
      <h2>Subscriptions & promo codes</h2>
      <ResourceState {...r}>
        <div className="summary-grid">
          {["active", "expired", "revoked"].map((kind) => (
            <div className="card" key={kind}>
              <p>{kind}</p>
              <h3>
                {r.data?.subscriptions.filter((s) =>
                  kind === "revoked"
                    ? !!s.revoked_at
                    : !s.revoked_at &&
                      (kind === "active"
                        ? Date.parse(String(s.expires_at)) > clock
                        : Date.parse(String(s.expires_at)) <= clock),
                ).length || 0}
              </h3>
            </div>
          ))}
        </div>
        <div className="live-grid">
          <form
            className="card form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const p = Object.fromEntries(new FormData(e.currentTarget));
              void run(async () => {
                const result = await api<{ code: string }>(
                  "admin/subscriptions/codes",
                  "POST",
                  {
                    label: p.label,
                    code: p.code || undefined,
                    days: Number(p.days),
                    limit: Number(p.limit),
                    expires_at: p.expires
                      ? new Date(String(p.expires)).toISOString()
                      : null,
                  },
                );
                setCode(result.code);
                await r.load();
              });
            }}
          >
            <h3>Create promo code</h3>
            {[
              ["label", "Label"],
              ["code", "Custom code (optional)"],
              ["days", "Days"],
              ["limit", "Redemption limit"],
              ["expires", "Expiration (optional)"],
            ].map(([name, label]) => (
              <label className="field" key={name}>
                {label}
                <input
                  className="input"
                  name={name}
                  type={
                    ["days", "limit"].includes(name)
                      ? "number"
                      : name === "expires"
                        ? "datetime-local"
                        : "text"
                  }
                  defaultValue={
                    name === "days" ? 30 : name === "limit" ? 1 : undefined
                  }
                  min={1}
                  max={name === "days" ? 3650 : 100000}
                  required={["days", "limit", "label"].includes(name)}
                />
              </label>
            ))}
            <button className="button primary">Generate code</button>
            {code && (
              <div role="status">
                <p>Copy now; the code is shown only once.</p>
                <code>{code}</code>
              </div>
            )}
          </form>
          <form
            className="card form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const p = Object.fromEntries(new FormData(e.currentTarget));
              void mutate("grant", {
                user_id: p.user_id,
                days: Number(p.days),
              });
            }}
          >
            <h3>Manual Premium activation</h3>
            <label className="field">
              Student
              <select name="user_id" className="input" required>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {String(u.display_name)} · {u.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Days
              <input
                name="days"
                type="number"
                className="input"
                defaultValue={30}
                min={1}
                max={3650}
                required
              />
            </label>
            <button className="button primary">Activate Premium</button>
          </form>
        </div>
        <h3>Promo codes</h3>
        {r.data?.codes.map((c) => (
          <article className="card" key={c.id}>
            <h4>{String(c.label)}</h4>
            <p>
              {String(c.days)} days · {String(c.used)}/{String(c.limit)} uses ·{" "}
              {c.revoked_at ? "Revoked" : c.enabled ? "Enabled" : "Disabled"}
            </p>
            <div className="live-actions">
              <button
                className="button outline"
                onClick={() =>
                  void mutate("code", { id: c.id, enabled: !c.enabled })
                }
              >
                Enable / Disable
              </button>
              <button
                className="button outline"
                onClick={() =>
                  window.confirm("Revoke this promo code?") &&
                  void mutate("code", { id: c.id, revoke: true })
                }
              >
                Revoke code
              </button>
            </div>
          </article>
        ))}
        <h3>Subscriber history</h3>
        <div className="live-actions">
          <input
            className="input"
            aria-label="Search subscribers"
            placeholder="Name or student ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            aria-label="Subscription status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["all", "active", "expired", "revoked"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {r.data?.subscriptions
          .filter((s) => {
            const state = s.revoked_at
              ? "revoked"
              : Date.parse(String(s.expires_at)) > clock
                ? "active"
                : "expired";
            return (
              (status === "all" || status === state) &&
              (
                String(s.user_id) +
                " " +
                String(
                  users.data?.find((u) => u.id === s.user_id)?.display_name ||
                    "",
                )
              )
                .toLowerCase()
                .includes(search.toLowerCase())
            );
          })
          .map((s) => (
            <article className="card" key={s.id}>
              <p>
                {String(
                  users.data?.find((u) => u.id === s.user_id)?.display_name ||
                    s.user_id,
                )}
              </p>
              <p>
                {String(s.activated_at)} → {String(s.expires_at)} ·{" "}
                {s.revoked_at
                  ? "Revoked"
                  : Date.parse(String(s.expires_at)) > clock
                    ? "Active"
                    : "Expired"}
              </p>
              {!s.revoked_at && (
                <button
                  className="button outline"
                  onClick={() =>
                    window.confirm("Revoke this grant?") &&
                    void mutate("revoke", { id: s.id })
                  }
                >
                  Revoke access
                </button>
              )}
            </article>
          ))}
        <h3>Redemption history</h3>
        {r.data?.redemptions.map((x) => (
          <p key={x.id}>
            {String(x.user_id)} · {String(x.code_id)} · {String(x.redeemed_at)}
          </p>
        ))}
      </ResourceState>
    </section>
  );
}
export function PremiumLock() {
  const { t } = useApp();
  return (
    <div className="notice">
      <p>{t("premium_required")}</p>
      <Link href="/settings" className="button primary">
        {t("activate_premium")}
      </Link>
    </div>
  );
}
