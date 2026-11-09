"use client";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { SkillProgressChart } from "@/components/charts/skill-chart";
import { learningScores } from "./premium-ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, RequestError, type Me, type Row } from "@/lib/api";
import { translate, type Language } from "@/lib/i18n";
import {
  AcademyContext,
  useApp,
  useResource,
  ResourceState,
  Empty,
} from "./academy-context";
export function AcademyProvider({
  route,
  children,
}: {
  route: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null),
    [lang, setLanguage] = useState<Language>("en"),
    [theme, setTheme] = useState("light"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const t = useCallback((key: string) => translate(lang, key), [lang]);
  const refresh = useCallback(async () => {
    try {
      const user = await api<Me>("me");
      setMe(user);
      setLanguage(user.preferences.language);
      setTheme(user.preferences.theme);
      setError("");
    } catch (e) {
      setMe(null);
      setError(e instanceof RequestError ? e.code : "server_error");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = theme;
  }, [lang, theme]);
  const publicRoute = [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].includes(route);
  useEffect(() => {
    if (loading || publicRoute) return;
    if (!me) {
      if (error === "unauthorized") router.replace("/login");
      return;
    }
    if (me.destination === "/onboarding" && route !== "/onboarding")
      router.replace("/onboarding");
    if (route === "/admin" && !me.roles.includes("ADMIN"))
      router.replace(me.destination);
    if (
      route === "/teacher" &&
      !me.roles.some((x) => x === "ADMIN" || x === "TEACHER")
    )
      router.replace(me.destination);
    if (route === "/dashboard" && me.destination !== "/dashboard")
      router.replace(me.destination);
    if (route === "/onboarding" && !me.roles.includes("STUDENT"))
      router.replace(me.destination);
  }, [loading, publicRoute, me, error, route, router]);
  async function setLang(l: Language) {
    setLanguage(l);
    if (me)
      try {
        await api("preferences", "PATCH", { language: l });
      } catch (e) {
        setNotice(e instanceof RequestError ? e.code : "server_error");
      }
  }
  const run = useCallback(
    async <T,>(job: () => Promise<T>): Promise<T | undefined> => {
      setNotice("");
      try {
        return await job();
      } catch (e) {
        setNotice(e instanceof RequestError ? e.code : "server_error");
        return undefined;
      }
    },
    [],
  );
  async function saveTheme(value: "light" | "dark") {
    await run(async () => {
      if (me) await api("preferences", "PATCH", { theme: value });
      setTheme(value);
    });
  }
  return (
    <AcademyContext.Provider
      value={{
        me,
        lang,
        setLang,
        theme,
        setTheme: saveTheme,
        t,
        notify: setNotice,
        refresh,
        run,
      }}
    >
      {publicRoute ? (
        children
      ) : (
        <ResourceState loading={loading} error={!me ? error : ""}>
          {me && children}
        </ResourceState>
      )}
      {notice && (
        <div
          className="live-toast"
          role={notice === "saved" ? "status" : "alert"}
        >
          <span>{t(notice)}</span>
          <button aria-label={t("back")} onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </AcademyContext.Provider>
  );
}
export function AccountForm({ route }: { route: string }) {
  const { t, run, refresh, notify } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const register = route === "/register",
    forgot = route === "/forgot-password",
    reset = route === "/reset-password";
  const action = register
    ? "register"
    : forgot
      ? "forgot"
      : reset
        ? "reset"
        : "login";
  return (
    <div className="premium-account">
      <span className="hero-kicker">IELTS ACADEMY</span>
      <h1>{t(register ? "register" : forgot || reset ? "reset" : "login")}</h1>
      {done ? (
        <p role="status">{t("check_email")}</p>
      ) : (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const body = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            void run(async () => {
              const r = await api<{
                verificationRequired?: boolean;
                destination?: string;
              }>("auth/" + action, "POST", body);
              if (forgot || r.verificationRequired) {
                setDone(true);
              } else if (reset) {
                notify("saved");
                router.push("/login");
              } else {
                await refresh();
                router.push(r.destination || "/dashboard");
              }
            }).finally(() => setBusy(false));
          }}
        >
          {register && (
            <label className="field">
              {t("name")}
              <input
                className="input"
                name="name"
                autoComplete="name"
                required
                maxLength={100}
              />
            </label>
          )}
          {!reset && (
            <label className="field">
              {t("email")}
              <input
                className="input"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>
          )}
          {!forgot && (
            <label className="field" htmlFor="account-password">
              {t("password")}
              <div className="password-field">
                <input
                  className="input"
                  name="password"
                  id="account-password"
                  type={showPassword ? "text" : "password"}
                  minLength={12}
                  maxLength={128}
                  autoComplete={
                    register || reset ? "new-password" : "current-password"
                  }
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          )}
          <button disabled={busy} className="button primary">
            {t(
              busy
                ? "loading"
                : forgot || reset
                  ? "reset"
                  : register
                    ? "register"
                    : "login",
            )}
          </button>
        </form>
      )}
      <div className="live-actions">
        <Link href="/login">{t("login")}</Link>
        <Link href="/register">{t("register")}</Link>
        <Link href="/forgot-password">{t("forgot")}</Link>
      </div>
    </div>
  );
}
export function PrivateMedia({
  path,
  bucket = "course-media",
  video = false,
  image = false,
  label,
}: {
  path: string;
  bucket?: string;
  video?: boolean;
  image?: boolean;
  label?: string;
}) {
  const { t, run } = useApp();
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    if (path.startsWith("https://")) {
      setUrl(path);
      return;
    }
    void api<{ signedUrl: string }>("media-url", "POST", { bucket, path })
      .then((r) => {
        if (live) setUrl(r.signedUrl);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [path, bucket]);
  if (!url)
    return (
      <button
        className="button outline"
        onClick={() =>
          void run(async () => {
            setUrl(
              (
                await api<{ signedUrl: string }>("media-url", "POST", {
                  bucket,
                  path,
                })
              ).signedUrl,
            );
          })
        }
      >
        {t("retry")}
      </button>
    );
  if (image)
    return (
      <picture>
        <img src={url} alt={label || t("writing")} className="task-image" />
      </picture>
    );
  if (video && /youtube\.com|youtu\.be/.test(url))
    return (
      <a
        className="text-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label || t("lessons")} ↗
      </a>
    );
  if (video) return <video src={url} controls preload="metadata" />;
  if (label)
    return (
      <a
        className="text-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    );
  return <audio src={url} controls preload="metadata" />;
}
export function Results() {
  const { t, run, notify } = useApp();
  const attempts = useResource<Row[]>("attempts"),
    subs = useResource<{ writing: Row[]; speaking: Row[] }>("submissions"),
    mocks = useResource<Row[]>("mock-results");
  const scores = learningScores(
    attempts.data || [],
    subs.data || { writing: [], speaking: [] },
  );
  return (
    <>
      <h1>{t("progress")}</h1>
      <ResourceState
        loading={attempts.loading || subs.loading || mocks.loading}
        error={attempts.error || subs.error || mocks.error}
      >
        <div className="summary-grid premium-progress-summary">
          <section className="card">
            <div className="summary-label">Objective practice completed</div>
            <div className="summary-number">
              {attempts.data?.filter((a) => a.status === "submitted").length ||
                0}
            </div>
            <p>Reading and Listening</p>
          </section>
          <section className="card">
            <div className="summary-label">Writing submitted</div>
            <div className="summary-number">
              {subs.data?.writing.filter((a) => a.submitted_at).length || 0}
            </div>
            <p>Your saved responses</p>
          </section>
          <section className="card">
            <div className="summary-label">Speaking recordings</div>
            <div className="summary-number">
              {subs.data?.speaking.length || 0}
            </div>
            <p>Your private recordings</p>
          </section>
          <section className="card">
            <div className="summary-label">Mock exams completed</div>
            <div className="summary-number">
              {mocks.data?.filter((a) => a.submitted_at).length || 0}
            </div>
            <p>All sections submitted</p>
          </section>
        </div>
        <section className="card chart-card">
          <div className="section-heading">
            <div>
              <h3>Your progress, reflected.</h3>
              <p>Every saved grade is another step forward.</p>
            </div>
          </div>
          <SkillProgressChart
            data={scores.map((s) => ({
              week: new Date(s.date).toLocaleDateString(),
              [s.skill[0].toUpperCase() + s.skill.slice(1)]: s.band,
            }))}
          />
        </section>
      </ResourceState>
      <ResourceState {...attempts}>
        {!attempts.data?.length ? (
          <Empty />
        ) : (
          attempts.data.map((a) => (
            <article className="card" key={a.id}>
              <h3>{String((a.tests as Row)?.title || "")}</h3>
              <p>
                {t(a.status === "submitted" ? "completed" : "resume")} ·{" "}
                {a.raw_score === null
                  ? "—"
                  : `${a.raw_score}/${a.total_points}`}{" "}
                {a.band !== null && `${t("band")} ${a.band}`}
              </p>
              <small>{t("estimated")}</small>
              <code>{a.id}</code>
            </article>
          ))
        )}
      </ResourceState>
      <ResourceState {...subs}>
        {(["writing", "speaking"] as const).map((kind) => (
          <section key={kind}>
            <h2>{t(kind)}</h2>
            {!subs.data?.[kind].length ? (
              <Empty />
            ) : (
              subs.data[kind].map((s) => (
                <article className="card" key={s.id}>
                  <h3>{String((s[kind + "_tasks"] as Row)?.title || "")}</h3>
                  <code>{s.id}</code>
                  {kind === "writing" ? (
                    <p className="preserve-text">{String(s.body)}</p>
                  ) : (
                    <PrivateMedia
                      path={String(s.storage_path)}
                      bucket="speaking"
                    />
                  )}
                  {!(s[kind + "_evaluations"] as Row[])?.length ? (
                    <p>{t("pending")}</p>
                  ) : (
                    (s[kind + "_evaluations"] as Row[])
                      .sort((a, b) =>
                        String(b.created_at).localeCompare(
                          String(a.created_at),
                        ),
                      )
                      .map((e) => (
                        <div className="notice" key={e.id}>
                          <strong>
                            {e.source === "ai" ? t("estimated") : t("teacher")}{" "}
                            {String(e.band ?? "")}
                          </strong>
                          <EvaluationFeedback row={e} />
                        </div>
                      ))
                  )}
                  <button
                    className="button outline"
                    onClick={() =>
                      void run(async () => {
                        await api("ai", "POST", { kind, id: s.id });
                        notify("saved");
                        await subs.load();
                      })
                    }
                  >
                    {t("ai")}
                  </button>
                </article>
              ))
            )}
          </section>
        ))}
      </ResourceState>
      <ResourceState {...mocks}>
        <h2>{t("mock")}</h2>
        {!mocks.data?.length ? (
          <Empty />
        ) : (
          mocks.data.map((a) => (
            <div className="card" key={a.id}>
              <h3>{String((a.mock_exams as Row)?.title || "")}</h3>
              <p>{t(a.submitted_at ? "completed" : "pending")}</p>
              <p>{t("mock_pending")}</p>
              {!!a.scorecard && (
                <div>
                  {(
                    (
                      a.scorecard as {
                        sections: { skill: string; band: number | null }[];
                      }
                    ).sections || []
                  ).map((s) => (
                    <p key={s.skill}>
                      {t(s.skill)}: {s.band === null ? t("pending") : s.band}
                    </p>
                  ))}
                  <strong>
                    {t("band")}:{" "}
                    {String(
                      (a.scorecard as { overall_band: number | null })
                        .overall_band ?? "—",
                    )}
                  </strong>
                  <p>{t("estimated")}</p>
                </div>
              )}
            </div>
          ))
        )}
      </ResourceState>
    </>
  );
}
export function Preferences({
  hideHeading = false,
}: {
  hideHeading?: boolean;
}) {
  const { me, t, run, refresh, notify } = useApp();
  return (
    <>
      {!hideHeading && <h1>{t("settings")}</h1>}
      <div className="card">
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const display_name = String(
              new FormData(e.currentTarget).get("display_name"),
            );
            void run(async () => {
              await api("profile", "PATCH", { display_name });
              await refresh();
              notify("saved");
            });
          }}
        >
          <label className="field">
            {t("name")}
            <input
              className="input"
              name="display_name"
              required
              minLength={1}
              maxLength={100}
              defaultValue={me?.profile.display_name}
            />
          </label>
          <button className="button primary">{t("save")}</button>
        </form>
        <label className="live-check">
          <input
            type="checkbox"
            checked={me?.preferences.ai_consent || false}
            onChange={(e) =>
              void run(async () => {
                await api("preferences", "PATCH", {
                  ai_consent: e.target.checked,
                });
                await refresh();
                notify("saved");
              })
            }
          />
          {t("consent")}
        </label>
        <Link href="/onboarding" className="button outline">
          {t("edit")} · {t("summary")}
        </Link>
      </div>
    </>
  );
}

export function LearningProfile() {
  const { me, t } = useApp();
  return me?.onboarding ? (
    <div className="card">
      <h2>{t("summary")}</h2>
      <p>
        {t("target_band")} {String(me.onboarding.target_band ?? "—")}
      </p>
      <p>
        {t("daily_goal_minutes")}{" "}
        {String(me.onboarding.daily_goal_minutes ?? "—")}
      </p>
      <Link className="text-link" href="/onboarding">
        {t("edit")}
      </Link>
    </div>
  ) : null;
}

export function EvaluationFeedback({ row }: { row: Row }) {
  const { t } = useApp();
  let feedback: Record<string, unknown> | null = null;
  if (row.source === "ai") {
    try {
      feedback = JSON.parse(String(row.feedback));
    } catch {
      feedback = null;
    }
  }
  return (
    <div>
      <p className="preserve-text">
        {feedback ? String(feedback.feedback) : String(row.feedback)}
      </p>
      {feedback &&
        Object.entries((feedback.criteria as Record<string, number>) || {}).map(
          ([k, v]) => (
            <p key={k}>
              {t(k)}: {v}
            </p>
          ),
        )}
      {!!feedback?.grammar_feedback && (
        <p>
          {t("grammar")}: {String(feedback.grammar_feedback)}
        </p>
      )}
      {!!feedback?.vocabulary_feedback && (
        <p>
          {t("lexical")}: {String(feedback.vocabulary_feedback)}
        </p>
      )}
      {feedback && Array.isArray(feedback.improvements) && (
        <ul>
          {feedback.improvements.map((v, i) => (
            <li key={i}>{String(v)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
