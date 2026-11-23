"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Row } from "@/lib/api";
import {
  formatDate,
  formatDateTime,
  fromLocalInput,
  toLocalInput,
} from "@/lib/dates";
import { useApp, useResource, ResourceState } from "./academy-context";

const categories = [
  ["listening", "listening"],
  ["reading", "reading"],
  ["writing", "writing"],
  ["speaking", "speaking"],
  ["courses", "courses"],
  ["mock", "mock_exams"],
  ["html", "html_tests"],
] as const;

function useScopeText() {
  const { t } = useApp();
  return (scope: unknown) =>
    Array.isArray(scope) && scope.length
      ? categories
          .filter(([key]) => scope.includes(key))
          .map(([, label]) => t(label))
          .join(", ")
      : t("p_scope_all");
}

export function SubscriptionPanel() {
  const { run, notify, t } = useApp();
  const scopeText = useScopeText();
  const r = useResource<Row>("subscription");
  const premium = r.data?.tier === "premium";
  return (
    <section className="card subscription-panel">
      <h2>{t("premium_access")}</h2>
      <ResourceState {...r}>
        <p>
          <strong>{t(premium ? "premium" : "free").toUpperCase()}</strong>
          {premium && (
            <>
              {" "}
              · {String(r.data?.remaining_days || 0)} {t("days_remaining")}
            </>
          )}
        </p>
        {premium && (
          <>
            <p>
              {t("p_covers")}: {scopeText(r.data?.scope)}
            </p>
            <p>
              {t("p_until")}: {formatDate(r.data?.expires_at)}
            </p>
          </>
        )}
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const code = String(new FormData(form).get("code"));
            void run(async () => {
              await api("subscription/redeem", "POST", { code });
              form.reset();
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
              pattern="[A-Za-z0-9\-]+"
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

function ScopePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { t } = useApp();
  return (
    <fieldset className="field">
      <legend>{t("p_scope")}</legend>
      <div className="live-choices">
        <label>
          <input
            type="checkbox"
            checked={!value.length}
            onChange={() => onChange([])}
          />
          {t("p_scope_all")}
        </label>
        {categories.map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={value.includes(key)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, key]
                    : value.filter((x) => x !== key),
                )
              }
            />
            {t(label)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type PromoValues = {
  label: string;
  code: string;
  days: number;
  limit: number;
  expires: string;
  scope: string[];
};
function PromoForm({
  initial,
  submitLabel,
  withCode,
  onSubmit,
  onCancel,
}: {
  initial?: Row;
  submitLabel: string;
  withCode?: boolean;
  onSubmit: (v: PromoValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const { t } = useApp();
  const [v, setV] = useState<PromoValues>({
    label: String(initial?.label ?? ""),
    code: "",
    days: Number(initial?.days ?? 30),
    limit: Number(initial?.limit ?? 1),
    expires: toLocalInput(initial?.expires_at),
    scope: Array.isArray(initial?.scope) ? (initial.scope as string[]) : [],
  });
  const set = <K extends keyof PromoValues>(k: K, value: PromoValues[K]) =>
    setV((x) => ({ ...x, [k]: value }));
  return (
    <form
      className="card form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(v);
      }}
    >
      <label className="field">
        {t("p_label")}
        <input
          className="input"
          value={v.label}
          maxLength={100}
          required
          onChange={(e) => set("label", e.target.value)}
        />
      </label>
      {withCode && (
        <label className="field">
          {t("p_code")}
          <input
            className="input"
            value={v.code}
            minLength={8}
            maxLength={64}
            pattern="[A-Za-z0-9\-]*"
            autoComplete="off"
            onChange={(e) => set("code", e.target.value)}
          />
        </label>
      )}
      <label className="field">
        {t("p_days")}
        <input
          className="input"
          type="number"
          min={1}
          max={3650}
          value={v.days}
          required
          onChange={(e) => set("days", Number(e.target.value))}
        />
      </label>
      <label className="field">
        {t("p_limit")}
        <input
          className="input"
          type="number"
          min={Math.max(1, Number(initial?.used ?? 0))}
          max={100000}
          value={v.limit}
          required
          onChange={(e) => set("limit", Number(e.target.value))}
        />
      </label>
      <label className="field">
        {t("p_expires")}
        <input
          className="input"
          type="datetime-local"
          min={toLocalInput(new Date().toISOString())}
          value={v.expires}
          onChange={(e) => set("expires", e.target.value)}
        />
      </label>
      <ScopePicker value={v.scope} onChange={(s) => set("scope", s)} />
      {!withCode && <p className="muted">{t("p_edit_hint")}</p>}
      <div className="live-actions">
        <button className="button primary">{submitLabel}</button>
        {onCancel && (
          <button type="button" className="button outline" onClick={onCancel}>
            {t("back")}
          </button>
        )}
      </div>
    </form>
  );
}

export function SubscriptionManager() {
  const { run, notify, t } = useApp();
  const scopeText = useScopeText();
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
  const [editing, setEditing] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [grantScope, setGrantScope] = useState<string[]>([]);
  const userName = (id: unknown) =>
    String(users.data?.find((u) => u.id === id)?.display_name || id);
  async function mutate(path: string, body: unknown) {
    await run(async () => {
      await api("admin/subscriptions/" + path, "POST", body);
      setEditing("");
      await r.load();
      notify("saved");
    });
  }
  const subState = (s: Row) =>
    s.revoked_at
      ? "revoked"
      : Date.parse(String(s.expires_at)) > clock
        ? "active"
        : "expired";
  const codeState = (c: Row) =>
    c.revoked_at
      ? "revoked"
      : !c.enabled
        ? "disabled"
        : c.expires_at && Date.parse(String(c.expires_at)) <= clock
          ? "expired"
          : "active";
  return (
    <section>
      <h2>{t("p_title")}</h2>
      <ResourceState {...r}>
        <div className="summary-grid">
          {["active", "expired", "revoked"].map((kind) => (
            <div className="card" key={kind}>
              <p>{t("p_state_" + kind)}</p>
              <h3>
                {r.data?.subscriptions.filter((s) => subState(s) === kind)
                  .length || 0}
              </h3>
            </div>
          ))}
        </div>
        <div className="live-grid">
          <div>
            <h3>{t("p_create")}</h3>
            <PromoForm
              withCode
              submitLabel={t("p_create")}
              onSubmit={(v) =>
                run(async () => {
                  const result = await api<{ code: string }>(
                    "admin/subscriptions/codes",
                    "POST",
                    {
                      label: v.label,
                      code: v.code || undefined,
                      days: v.days,
                      limit: v.limit,
                      expires_at: fromLocalInput(v.expires),
                      scope: v.scope,
                    },
                  );
                  setCode(result.code);
                  await r.load();
                  notify("saved");
                }).then(() => undefined)
              }
            />
            {code && (
              <div className="card" role="status">
                <p>{t("p_copy_now")}</p>
                <code>{code}</code>
              </div>
            )}
          </div>
          <form
            className="card form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const p = Object.fromEntries(new FormData(e.currentTarget));
              void mutate("grant", {
                user_id: p.user_id,
                days: Number(p.days),
                scope: grantScope,
              });
            }}
          >
            <h3>{t("p_manual")}</h3>
            <label className="field">
              {t("p_user")}
              <select name="user_id" className="input" required defaultValue="">
                <option value="" disabled>
                  {t("none")}
                </option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {String(u.display_name)} · {u.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t("p_days")}
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
            <ScopePicker value={grantScope} onChange={setGrantScope} />
            <button className="button primary">{t("p_activate")}</button>
          </form>
        </div>
        <h3>{t("p_codes")}</h3>
        {!r.data?.codes.length && <p className="notice">{t("p_none")}</p>}
        {r.data?.codes.map((c) =>
          editing === c.id ? (
            <PromoForm
              key={c.id}
              initial={c}
              submitLabel={t("save")}
              onCancel={() => setEditing("")}
              onSubmit={(v) =>
                mutate("code", {
                  id: c.id,
                  label: v.label,
                  days: v.days,
                  limit: v.limit,
                  expires_at: fromLocalInput(v.expires),
                  scope: v.scope,
                })
              }
            />
          ) : (
            <article className="card" key={c.id}>
              <h4>
                {String(c.label)} · {t("p_state_" + codeState(c))}
              </h4>
              <p>
                {String(c.days)} {t("p_days").toLowerCase()} · {t("p_used")}{" "}
                {String(c.used)}/{String(c.limit)} · {t("p_covers")}:{" "}
                {scopeText(c.scope)} ·{" "}
                {c.expires_at
                  ? t("p_until") + " " + formatDateTime(c.expires_at)
                  : t("p_never")}
              </p>
              <div className="live-actions">
                <button
                  className="button outline"
                  onClick={() => setEditing(String(c.id))}
                >
                  {t("edit")}
                </button>
                {!c.revoked_at && (
                  <button
                    className="button outline"
                    onClick={() =>
                      void mutate("code", { id: c.id, enabled: !c.enabled })
                    }
                  >
                    {t(c.enabled ? "p_disable" : "p_enable")}
                  </button>
                )}
                <button
                  className="button outline"
                  onClick={() =>
                    c.revoked_at
                      ? void mutate("code", { id: c.id, revoke: false })
                      : window.confirm(t("p_confirm_revoke")) &&
                        void mutate("code", { id: c.id, revoke: true })
                  }
                >
                  {t(c.revoked_at ? "p_restore" : "p_revoke")}
                </button>
                {Number(c.used) === 0 && (
                  <button
                    className="button outline"
                    onClick={() =>
                      window.confirm(t("p_confirm_delete")) &&
                      void mutate("code", { id: c.id, delete: true })
                    }
                  >
                    {t("p_delete")}
                  </button>
                )}
              </div>
            </article>
          ),
        )}
        <h3>{t("p_grants")}</h3>
        <div className="live-actions">
          <input
            className="input"
            aria-label={t("p_user")}
            placeholder={t("p_user")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            aria-label={t("status")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">{t("p_scope_all")}</option>
            {["active", "expired", "revoked"].map((s) => (
              <option key={s} value={s}>
                {t("p_state_" + s)}
              </option>
            ))}
          </select>
        </div>
        {r.data?.subscriptions
          .filter(
            (s) =>
              (status === "all" || status === subState(s)) &&
              (String(s.user_id) + " " + userName(s.user_id))
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((s) => (
            <article className="card" key={s.id}>
              <p>
                <strong>{userName(s.user_id)}</strong> ·{" "}
                {t("p_state_" + subState(s))}
              </p>
              <p>
                {formatDateTime(s.activated_at)} →{" "}
                {formatDateTime(s.expires_at)} · {t("p_covers")}:{" "}
                {scopeText(s.scope)}
              </p>
              {!s.revoked_at && (
                <button
                  className="button outline"
                  onClick={() =>
                    window.confirm(t("p_confirm_revoke")) &&
                    void mutate("revoke", { id: s.id })
                  }
                >
                  {t("p_revoke")}
                </button>
              )}
            </article>
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
