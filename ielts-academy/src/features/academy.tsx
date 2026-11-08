"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Headphones,
  Mic,
  PenLine,
  LayoutDashboard,
  GraduationCap,
  Settings,
  ClipboardList,
  ArrowRight,
  Sun,
  Moon,
} from "lucide-react";
import { api, RequestError, type Me, type Row } from "@/lib/api";
import { translate, type Language } from "@/lib/i18n";
import {
  AcademyContext,
  useApp,
  useResource,
  ResourceState,
  Empty,
  PageControls,
} from "./academy-context";
import { Onboarding } from "./onboarding";
import { ContentStudio, TeacherWorkspace } from "./content-studio";
import {
  PracticeRoom,
  WritingRoom,
  SpeakingRoom,
  MockRoom,
} from "./learning-rooms";
const nav = [
  ["dashboard", "/dashboard", LayoutDashboard],
  ["listening", "/practice/listening", Headphones],
  ["reading", "/practice/reading", BookOpen],
  ["writing", "/practice/writing", PenLine],
  ["speaking", "/practice/speaking", Mic],
  ["mock", "/mock-exams", ClipboardList],
  ["courses", "/courses", GraduationCap],
  ["progress", "/progress", BookOpen],
  ["settings", "/settings", Settings],
] as const;
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon">
        <BookOpen size={23} />
      </span>
      <span>
        IELTS<span className="brand-light"> Academy</span>
      </span>
    </Link>
  );
}
export function Academy({ route }: { route: string }) {
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
  const language = (
    <label className="language-control">
      <span>{t("language")}</span>
      <select
        aria-label={t("language")}
        className="input"
        value={lang}
        onChange={(e) => void setLang(e.target.value as Language)}
      >
        <option value="en">English</option>
        <option value="uz">O‘zbekcha</option>
        <option value="ru">Русский</option>
      </select>
    </label>
  );
  return (
    <AcademyContext.Provider
      value={{ me, lang, setLang, t, notify: setNotice, refresh, run }}
    >
      {publicRoute ? (
        <>
          <header className="live-public-header">
            <Brand />
            {language}
            <Link
              className="button outline"
              href={me ? me.destination : "/login"}
            >
              {t(me ? "dashboard" : "login")}
            </Link>
          </header>
          {route === "/" ? (
            <main className="live-landing">
              <span className="hero-kicker">IELTS ACADEMY</span>
              <h1>{t("welcome")}</h1>
              <p>{t("subtitle")}</p>
              <Link href="/register" className="button primary">
                {t("register")}
                <ArrowRight size={18} />
              </Link>
              <div className="live-grid">
                {nav.slice(1, 5).map(([key, , Icon]) => (
                  <div className="card" key={key}>
                    <Icon />
                    <h2>{t(key)}</h2>
                  </div>
                ))}
              </div>
            </main>
          ) : (
            <AccountForm route={route} />
          )}
        </>
      ) : (
        <div className="live-shell">
          <aside className="live-sidebar">
            <Brand />
            <nav aria-label={t("dashboard")}>
              {nav.map(([key, path, Icon]) => (
                <Link
                  aria-current={route === path ? "page" : undefined}
                  className={route === path ? "active" : ""}
                  key={path}
                  href={path}
                >
                  <Icon size={18} />
                  {t(key)}
                </Link>
              ))}
              {me?.roles.includes("ADMIN") && (
                <Link href="/admin">{t("admin")}</Link>
              )}
              {me?.roles.some((x) => ["ADMIN", "TEACHER"].includes(x)) && (
                <Link href="/teacher">{t("teacher")}</Link>
              )}
            </nav>
            <button
              className="button outline"
              onClick={() =>
                void run(async () => {
                  await api("auth/logout", "POST", {});
                  setMe(null);
                  router.replace("/login");
                })
              }
            >
              {t("logout")}
            </button>
          </aside>
          <div className="live-body">
            <header className="live-topbar">
              <span>{me?.profile.display_name}</span>
              {language}
              <button
                className="icon-button"
                aria-label={t("theme")}
                onClick={() =>
                  void run(async () => {
                    const value = theme === "dark" ? "light" : "dark";
                    await api("preferences", "PATCH", { theme: value });
                    setTheme(value);
                  })
                }
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </header>
            <main id="main" className="live-main">
              <ResourceState loading={loading} error={!me ? error : ""}>
                {me &&
                  (route === "/onboarding" ? (
                    <Onboarding />
                  ) : route === "/admin" ? (
                    me.roles.includes("ADMIN") && <ContentStudio />
                  ) : route === "/teacher" ? (
                    <TeacherWorkspace />
                  ) : route === "/courses" ? (
                    <CourseCatalog />
                  ) : route === "/progress" ? (
                    <Results />
                  ) : route === "/settings" ? (
                    <Preferences />
                  ) : route === "/practice/listening" ||
                    route === "/practice/reading" ? (
                    <PracticeRoom
                      skill={
                        route.endsWith("reading") ? "reading" : "listening"
                      }
                    />
                  ) : route === "/practice/writing" ? (
                    <WritingRoom />
                  ) : route === "/practice/speaking" ? (
                    <SpeakingRoom />
                  ) : route === "/mock-exams" ? (
                    <MockRoom />
                  ) : (
                    <Dashboard />
                  ))}
              </ResourceState>
            </main>
          </div>
        </div>
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
function AccountForm({ route }: { route: string }) {
  const { t, run, refresh, notify } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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
    <main className="live-account card">
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
            <label className="field">
              {t("password")}
              <input
                className="input"
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete={
                  register || reset ? "new-password" : "current-password"
                }
                required
              />
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
    </main>
  );
}
function Dashboard() {
  const { t } = useApp();
  const r = useResource<Record<string, Row[]>>("dashboard");
  return (
    <>
      <h1>{t("dashboard")}</h1>
      <LearningProfile />
      <ResourceState {...r}>
        <div className="live-grid">
          {[
            "test_attempts",
            "lesson_progress",
            "learning_activity_events",
            "student_achievements",
          ].map((k, i) => (
            <div className="card" key={k}>
              <span>
                {t(["attempts", "lessons", "activity", "achievements"][i])}
              </span>
              <h2>{r.data?.[k].length || 0}</h2>
            </div>
          ))}
        </div>
        <h2>{t("assignments")}</h2>
        {!r.data?.assignments.length ? (
          <Empty />
        ) : (
          r.data.assignments.map((row) => (
            <div className="card" key={row.id}>
              <h3>{row.title}</h3>
              <p>{String(row.due_date || "")}</p>
              <Link
                className="button outline"
                href={
                  row.test_id
                    ? "/practice/" +
                      String((row.tests as Row)?.skill || "reading")
                    : row.writing_task_id
                      ? "/practice/writing"
                      : row.speaking_task_id
                        ? "/practice/speaking"
                        : "/courses"
                }
              >
                {t("start")}
              </Link>
            </div>
          ))
        )}
      </ResourceState>
    </>
  );
}
function CourseCatalog() {
  const { t, run, notify } = useApp();
  const [page, setPage] = useState(0);
  const r = useResource<Row[]>(
    "catalog/courses" + (page ? "?page=" + page : ""),
  );
  const [selected, setSelected] = useState<Row | null>(null);
  return (
    <>
      <h1>{t("courses")}</h1>
      <ResourceState {...r}>
        {!r.data?.length ? (
          <Empty />
        ) : (
          <div className="live-grid">
            {r.data.map((c) => (
              <article className="card" key={c.id}>
                <h2>{c.title}</h2>
                <p>{String(c.description)}</p>
                <div className="live-actions">
                  <button
                    className="button outline"
                    onClick={() =>
                      void run(async () => {
                        setSelected(await api<Row>("course/" + c.id));
                      })
                    }
                  >
                    {t("preview")}
                  </button>
                  <button
                    className="button primary"
                    onClick={() =>
                      void run(async () => {
                        await api("enroll", "POST", { course_id: c.id });
                        notify("saved");
                      })
                    }
                  >
                    {t("enroll")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <PageControls
          page={page}
          onChange={setPage}
          count={r.data?.length || 0}
        />
      </ResourceState>
      {selected && (
        <section>
          <h2>{selected.title}</h2>
          {(selected.course_modules as Row[])
            .sort((a, b) => Number(a.position) - Number(b.position))
            .map((m) => (
              <section key={m.id}>
                <h3>{m.title}</h3>
                {(m.lessons as Row[])
                  .sort((a, b) => Number(a.position) - Number(b.position))
                  .map((l) => (
                    <article className="card" key={l.id}>
                      <h3>{l.title}</h3>
                      <p className="preserve-text">{String(l.body)}</p>
                      {!!l.video_url && (
                        <PrivateMedia path={String(l.video_url)} video />
                      )}
                      {((l.lesson_resources as Row[]) || []).map((a) => (
                        <PrivateMedia
                          key={a.id}
                          path={String(a.storage_path)}
                          label={a.title}
                        />
                      ))}
                      <button
                        className="button primary"
                        onClick={() =>
                          void run(async () => {
                            await api("complete", "POST", { lesson_id: l.id });
                            notify("saved");
                          })
                        }
                      >
                        {t("complete")}
                      </button>
                    </article>
                  ))}
              </section>
            ))}
        </section>
      )}
    </>
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
  return (
    <>
      <h1>{t("progress")}</h1>
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
function Preferences() {
  const { me, t, run, refresh, notify } = useApp();
  return (
    <>
      <h1>{t("settings")}</h1>
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

function LearningProfile() {
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
