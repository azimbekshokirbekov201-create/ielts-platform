"use client";
import { useEffect, useState } from "react";
import { api, type Row } from "@/lib/api";
import { uploadMedia } from "@/lib/media-upload";
import {
  useApp,
  useResource,
  ResourceState,
  Empty,
  PageControls,
} from "./academy-context";
import { PrivateMedia } from "./academy";
const templates: Record<string, Record<string, unknown>> = {
  courses: { title: "", description: "", status: "draft" },
  course_modules: { course_id: "", title: "", position: 0 },
  lessons: {
    module_id: "",
    title: "",
    body: "",
    video_url: null,
    position: 0,
    status: "draft",
  },
  lesson_resources: { lesson_id: "", title: "", storage_path: "" },
  tests: {
    title: "",
    skill: "reading",
    variant: "academic",
    duration_seconds: 3600,
    status: "draft",
    band_thresholds: null,
  },
  test_sections: { test_id: "", title: "", audio_path: null, position: 0 },
  passages: { section_id: "", title: "", body: "" },
  questions: {
    section_id: "",
    prompt: "",
    kind: "text",
    position: 0,
    max_words: null,
    points: 1,
  },
  question_options: { question_id: "", label: "", value: "" },
  answer_keys: { question_id: "", accepted: [], explanation: "" },
  writing_tasks: {
    title: "",
    prompt: "",
    task_number: 2,
    image_path: null,
    duration_seconds: 2400,
    status: "draft",
  },
  speaking_tasks: {
    title: "",
    prompt: "",
    part: 1,
    preparation_seconds: 60,
    response_seconds: 120,
    status: "draft",
  },
  mock_exams: {
    title: "",
    status: "draft",
    allow_resume: true,
    available_from: null,
    available_until: null,
  },
  mock_exam_sections: {
    mock_exam_id: "",
    skill: "reading",
    test_id: null,
    writing_task_id: null,
    speaking_task_id: null,
    position: 0,
  },
};
const refs: Record<string, string> = {
  course_id: "courses",
  module_id: "course_modules",
  lesson_id: "lessons",
  test_id: "tests",
  section_id: "test_sections",
  question_id: "questions",
  mock_exam_id: "mock_exams",
  writing_task_id: "writing_tasks",
  speaking_task_id: "speaking_tasks",
};
const enums: Record<string, string[]> = {
  status: ["draft", "published", "archived"],
  skill: ["listening", "reading", "writing", "speaking"],
  variant: ["academic", "general"],
  kind: [
    "text",
    "choice",
    "true_false_not_given",
    "yes_no_not_given",
    "matching",
    "multiple_choice",
  ],
};
const numbers = [
  "duration_seconds",
  "position",
  "max_words",
  "points",
  "task_number",
  "part",
  "preparation_seconds",
  "response_seconds",
];
export function ContentStudio() {
  const { t } = useApp();
  const [tab, setTab] = useState("content");
  const stats = useResource<Record<string, number>>("admin/stats");
  return (
    <>
      <h1>{t("admin")}</h1>
      <ResourceState {...stats}>
        <div className="live-grid">
          {Object.entries(stats.data || {}).map(([key, value]) => (
            <div className="card" key={key}>
              <span>
                {t(
                  key === "profiles"
                    ? "users"
                    : key === "test_attempts"
                      ? "attempts"
                      : key,
                )}
              </span>
              <h2>{value ?? "—"}</h2>
            </div>
          ))}
        </div>
      </ResourceState>
      <div className="live-actions">
        {["content", "users", "settings", "audit"].map((k) => (
          <button
            key={k}
            className={"button " + (tab === k ? "primary" : "outline")}
            onClick={() => setTab(k)}
          >
            {t(k)}
          </button>
        ))}
      </div>
      {tab === "content" ? (
        <ContentEditor />
      ) : tab === "users" ? (
        <UserManager />
      ) : tab === "settings" ? (
        <AISettings />
      ) : (
        <Audit />
      )}
    </>
  );
}
function ContentEditor() {
  const { t, run, notify } = useApp();
  const [table, setTable] = useState("courses"),
    [editing, setEditing] = useState<Row | null>(null),
    [values, setValues] = useState<Record<string, unknown>>(templates.courses),
    [choices, setChoices] = useState<Record<string, Row[]>>({}),
    [preview, setPreview] = useState<Row | null>(null),
    [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const r = useResource<Row[]>(
    "admin/content/" + table + (page ? "?page=" + page : ""),
  );
  useEffect(() => {
    let alive = true;
    const tables = [
      ...new Set(
        Object.keys(templates[table])
          .filter((k) => refs[k])
          .map((k) => refs[k]),
      ),
    ];
    void Promise.all(
      tables.map(
        async (name) =>
          [name, await api<Row[]>("admin/content/" + name)] as const,
      ),
    )
      .then((rows) => {
        if (alive) setChoices(Object.fromEntries(rows));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [table, r.data]);
  function edit(row: Row) {
    setEditing(row);
    setValues(
      Object.fromEntries(
        Object.keys(templates[table]).map((k) => [
          k,
          row[k] ?? templates[table][k],
        ]),
      ),
    );
  }
  function change(k: string, v: unknown) {
    setValues((a) => ({ ...a, [k]: v }));
  }
  async function mutate(row: Row, action: string) {
    await run(async () => {
      const id = String(row.id || row.question_id);
      if (action === "delete") {
        if (!window.confirm(t("confirm_delete"))) return;
        await api("admin/content/" + table + "/" + id, "DELETE");
      } else
        await api("admin/content/" + table + "/" + id, "PATCH", {
          status: action,
        });
      notify("saved");
      await r.load();
    });
  }
  return (
    <section>
      <h2>{t("content")}</h2>
      <label className="field">
        {t("content")}
        <select
          className="input"
          value={table}
          onChange={(e) => {
            setTable(e.target.value);
            setPage(0);
            setEditing(null);
            setValues(templates[e.target.value]);
            setPreview(null);
          }}
        >
          {Object.keys(templates).map((k) => (
            <option key={k} value={k}>
              {t(k)}
            </option>
          ))}
        </select>
      </label>
      <div className="studio-grid">
        <form
          className="card form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void run(async () => {
              const payload = { ...values };
              if (Array.isArray(payload.accepted))
                payload.accepted = payload.accepted
                  .map((v) => String(v).trim())
                  .filter(Boolean);
              if (
                table === "tests" &&
                typeof payload.band_thresholds === "string"
              ) {
                try {
                  payload.band_thresholds = payload.band_thresholds
                    ? JSON.parse(payload.band_thresholds)
                    : null;
                } catch {
                  notify("invalid_input");
                  return;
                }
              }
              await api(
                "admin/content/" +
                  table +
                  (editing ? "/" + (editing.id || editing.question_id) : ""),
                editing ? "PATCH" : "POST",
                payload,
              );
              notify("saved");
              setEditing(null);
              setValues(templates[table]);
              await r.load();
            }).finally(() => setBusy(false));
          }}
        >
          <h3>
            {t(editing ? "edit" : "create")} · {t(table)}
          </h3>
          {Object.entries(templates[table]).map(([key, defaultValue]) => {
            const value = values[key];
            const fk = refs[key];
            const options = enums[key]?.filter(
              (v) =>
                key !== "skill" ||
                table !== "tests" ||
                ["listening", "reading"].includes(v),
            );
            return (
              <label className="field" key={key}>
                {t(key)}
                {fk ? (
                  <select
                    className="input"
                    value={String(value || "")}
                    onChange={(e) => change(key, e.target.value || null)}
                    required={defaultValue !== null}
                  >
                    <option value="">{t("none")}</option>
                    {(choices[fk] || []).map((row) => (
                      <option key={row.id} value={row.id}>
                        {String(row.title || row.prompt || row.id)}
                      </option>
                    ))}
                  </select>
                ) : options ? (
                  <select
                    className="input"
                    value={String(value)}
                    onChange={(e) => change(key, e.target.value)}
                  >
                    {options.map((v) => (
                      <option key={v} value={v}>
                        {t(v)}
                      </option>
                    ))}
                  </select>
                ) : typeof defaultValue === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => change(key, e.target.checked)}
                  />
                ) : key === "accepted" ? (
                  <textarea
                    className="input"
                    required
                    value={((value as string[]) || []).join("\n")}
                    onChange={(e) => change(key, e.target.value.split("\n"))}
                  />
                ) : key === "band_thresholds" ? (
                  <textarea
                    className="input"
                    value={
                      value === null
                        ? ""
                        : typeof value === "string"
                          ? value
                          : JSON.stringify(value)
                    }
                    placeholder='[{"min":0,"band":0}]'
                    onChange={(e) => change(key, e.target.value)}
                  />
                ) : ["body", "description", "prompt", "explanation"].includes(
                    key,
                  ) ? (
                  <textarea
                    className="input"
                    rows={5}
                    value={String(value || "")}
                    required={key === "prompt" || key === "body"}
                    onChange={(e) => change(key, e.target.value)}
                  />
                ) : (
                  <input
                    className="input"
                    type={
                      numbers.includes(key)
                        ? "number"
                        : key.startsWith("available_")
                          ? "datetime-local"
                          : "text"
                    }
                    required={
                      defaultValue !== null &&
                      !["video_url", "audio_path", "image_path"].includes(key)
                    }
                    min={numbers.includes(key) ? 0 : undefined}
                    value={
                      key.startsWith("available_")
                        ? String(value || "").slice(0, 16)
                        : String(value ?? "")
                    }
                    onChange={(e) =>
                      change(
                        key,
                        numbers.includes(key)
                          ? e.target.value === ""
                            ? null
                            : Number(e.target.value)
                          : key.startsWith("available_")
                            ? e.target.value
                              ? new Date(e.target.value + "Z").toISOString()
                              : null
                            : e.target.value || defaultValue === null
                              ? e.target.value
                              : null,
                      )
                    }
                  />
                )}
              </label>
            );
          })}
          <button className="button primary" disabled={busy}>
            {t(busy ? "saving" : "save")}
          </button>
          {editing && (
            <button
              type="button"
              className="button outline"
              onClick={() => {
                setEditing(null);
                setValues(templates[table]);
              }}
            >
              {t("back")}
            </button>
          )}
        </form>
        <div>
          <MediaUpload />
          <ResourceState {...r}>
            {!r.data?.length ? (
              <Empty />
            ) : (
              r.data.map((row, i) => (
                <article
                  className="card"
                  key={String(row.id || row.question_id || i)}
                >
                  <h3>
                    {String(
                      row.title || row.prompt || row.label || row.question_id,
                    )}
                  </h3>
                  <code>{String(row.id || row.question_id)}</code>
                  {!!row.status && (
                    <span className="badge">{t(String(row.status))}</span>
                  )}
                  <div className="live-actions">
                    <button
                      className="button outline"
                      onClick={() => edit(row)}
                    >
                      {t("edit")}
                    </button>
                    <button
                      className="button outline"
                      onClick={() =>
                        void run(async () => {
                          setPreview(
                            table === "tests"
                              ? await api<Row>("test/" + row.id)
                              : table === "courses"
                                ? await api<Row>("course/" + row.id)
                                : row,
                          );
                        })
                      }
                    >
                      {t("preview")}
                    </button>
                    {!!row.status && (
                      <button
                        className="button outline"
                        onClick={() =>
                          void mutate(
                            row,
                            row.status === "published" ? "draft" : "published",
                          )
                        }
                      >
                        {t(
                          row.status === "published" ? "unpublish" : "publish",
                        )}
                      </button>
                    )}
                    <button
                      className="button ghost"
                      onClick={() => void mutate(row, "delete")}
                    >
                      {t("remove")}
                    </button>
                  </div>
                </article>
              ))
            )}
            <PageControls
              page={page}
              onChange={setPage}
              count={r.data?.length || 0}
              size={100}
            />
          </ResourceState>
        </div>
      </div>
      {preview && (
        <section className="card">
          <h2>
            {t("preview")} · {preview.title}
          </h2>
          {Object.keys(templates[table]).map((k) => (
            <div key={k}>
              <strong>{t(k)}</strong>
              <p className="preserve-text">
                {Array.isArray(preview[k])
                  ? JSON.stringify(preview[k])
                  : String(preview[k] ?? "")}
              </p>
            </div>
          ))}
          {((preview.test_sections as Row[]) || []).map((s) => (
            <section key={s.id}>
              <h3>{s.title}</h3>
              {!!s.audio_path && (
                <PrivateMedia path={String(s.audio_path)} />
              )}{" "}
              {((s.passages as Row[]) || []).map((p) => (
                <p className="preserve-text" key={p.id}>
                  {String(p.body)}
                </p>
              ))}
              {((s.questions as Row[]) || []).map((q) => (
                <article key={q.id}>
                  <strong>{String(q.prompt)}</strong>
                  {((q.question_options as Row[]) || []).map((o) => (
                    <p key={o.id}>{String(o.label)}</p>
                  ))}
                </article>
              ))}
            </section>
          ))}
          {((preview.course_modules as Row[]) || []).map((m) => (
            <section key={m.id}>
              <h3>{m.title}</h3>
              {((m.lessons as Row[]) || []).map((l) => (
                <article key={l.id}>
                  <h4>{l.title}</h4>
                  <p className="preserve-text">{String(l.body)}</p>
                  {!!l.video_url && (
                    <PrivateMedia path={String(l.video_url)} video />
                  )}
                </article>
              ))}
            </section>
          ))}
          <button className="button outline" onClick={() => setPreview(null)}>
            {t("back")}
          </button>
        </section>
      )}
    </section>
  );
}
function MediaUpload() {
  const { t, run } = useApp();
  const [path, setPath] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="card form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        f.set("bucket", "course-media");
        setBusy(true);
        void run(async () => {
          setPath(
            (await uploadMedia(f.get("file") as File, "course-media")).path,
          );
        }).finally(() => setBusy(false));
      }}
    >
      <label className="field">
        {t("upload")}
        <input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/wav,video/mp4"
        />
      </label>
      <button className="button outline" disabled={busy}>
        {t("upload")}
      </button>
      {path && (
        <label className="field">
          {t("storage_path")}
          <input className="input" readOnly value={path} />
        </label>
      )}
    </form>
  );
}
function UserManager() {
  const { t, run, notify } = useApp();
  const [page, setPage] = useState(0);
  const r = useResource<Row[]>("admin/users" + (page ? "?page=" + page : ""));
  return (
    <ResourceState {...r}>
      {!r.data?.length ? (
        <Empty />
      ) : (
        r.data.map((row) => (
          <article className="card" key={row.id}>
            <h3>{String(row.display_name)}</h3>
            <code>{row.id}</code>
            <div className="live-actions">
              {(row.user_roles as Row[]).map((roleRow) => (
                <span key={String(roleRow.role)}>
                  {t(String(roleRow.role))}
                  {roleRow.role !== "STUDENT" && (
                    <button
                      className="text-link"
                      onClick={() =>
                        void run(async () => {
                          await api("admin/roles", "POST", {
                            user_id: row.id,
                            role: roleRow.role,
                            remove: true,
                          });
                          notify("saved");
                          await r.load();
                        })
                      }
                    >
                      {t("remove")}
                    </button>
                  )}
                </span>
              ))}
            </div>
            <form
              className="live-actions"
              onSubmit={(e) => {
                e.preventDefault();
                const role = new FormData(e.currentTarget).get("role");
                void run(async () => {
                  await api("admin/roles", "POST", { user_id: row.id, role });
                  notify("saved");
                  await r.load();
                });
              }}
            >
              <label>
                {t("role")}
                <select className="input" name="role">
                  {["STUDENT", "TEACHER", "ADMIN"].map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button outline">{t("assign")}</button>
            </form>
          </article>
        ))
      )}
      <form
        className="card form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api(
              "admin/assign-teacher",
              "POST",
              Object.fromEntries(new FormData(e.currentTarget)),
            );
            notify("saved");
          });
        }}
      >
        {["teacher_id", "student_id"].map((k) => (
          <label className="field" key={k}>
            {t(k)}
            <select className="input" required name={k}>
              <option value="">{t("none")}</option>
              {r.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {String(u.display_name)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button className="button primary">{t("assign")}</button>
      </form>
      <PageControls
        page={page}
        onChange={setPage}
        count={r.data?.length || 0}
        size={100}
      />
    </ResourceState>
  );
}
function AISettings() {
  const { t, run, notify } = useApp();
  const r = useResource<Row>("admin/settings");
  return (
    <ResourceState {...r}>
      {r.data && (
        <form
          className="card form-stack"
          key={String(r.data.ai_enabled) + r.data.ai_daily_user_limit}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await api("admin/settings", "PATCH", {
                ai_enabled: f.get("ai_enabled") === "on",
                ai_daily_user_limit: Number(f.get("ai_daily_user_limit")),
                ai_daily_platform_limit: Number(
                  f.get("ai_daily_platform_limit"),
                ),
              });
              notify("saved");
              await r.load();
            });
          }}
        >
          <label className="live-check">
            <input
              type="checkbox"
              name="ai_enabled"
              defaultChecked={!!r.data.ai_enabled}
            />
            {t("ai_enabled")}
          </label>
          {["ai_daily_user_limit", "ai_daily_platform_limit"].map((k) => (
            <label className="field" key={k}>
              {t(k)}
              <input
                className="input"
                type="number"
                min={0}
                max={k === "ai_daily_user_limit" ? 100 : 10000}
                name={k}
                defaultValue={Number(r.data![k])}
              />
            </label>
          ))}
          <button className="button primary">{t("save")}</button>
        </form>
      )}
    </ResourceState>
  );
}
function Audit() {
  const { t } = useApp();
  const r = useResource<Row[]>("admin/audit");
  return (
    <ResourceState {...r}>
      <h2>{t("audit")}</h2>
      {!r.data?.length ? (
        <Empty />
      ) : (
        r.data.map((row) => (
          <div className="card" key={row.id}>
            <p>
              {String(row.created_at)} · {String(row.action)} ·{" "}
              {String(row.entity)}
            </p>
            <code>{String(row.entity_id)}</code>
          </div>
        ))
      )}
    </ResourceState>
  );
}
function TeacherProgress() {
  const { t } = useApp();
  const r = useResource<Row[]>("teacher/progress");
  return (
    <ResourceState {...r}>
      <h2>{t("progress")}</h2>
      {r.data?.map((s) => (
        <article className="card" key={s.id}>
          <h3>{String(s.display_name)}</h3>
          <p>
            {t("lessons")}: {((s.lesson_progress as Row[]) || []).length}
          </p>
          {((s.test_attempts as Row[]) || []).map((a) => (
            <p key={a.id}>
              {t(a.status === "submitted" ? "completed" : "pending")} ·{" "}
              {t("raw_score")}: {String(a.raw_score ?? "—")}/
              {String(a.total_points ?? "—")}
            </p>
          ))}
        </article>
      ))}
    </ResourceState>
  );
}
export function TeacherWorkspace() {
  const { t, run, notify } = useApp();
  const students = useResource<Row[]>("teacher/students"),
    submissions = useResource<{ writing: Row[]; speaking: Row[] }>(
      "submissions",
    ),
    assignments = useResource<Row[]>("teacher/assignments");
  const [review, setReview] = useState<{ row: Row; kind: string } | null>(null);
  const [kind, setKind] = useState("test_id");
  const library = useResource<Row[]>(
    "catalog/" +
      {
        test_id: "tests",
        lesson_id: "lessons",
        writing_task_id: "writing_tasks",
        speaking_task_id: "speaking_tasks",
      }[kind],
  );
  return (
    <>
      <h1>{t("teacher")}</h1>
      <TeacherProgress />
      <ResourceState {...students}>
        <h2>{t("users")}</h2>
        {!students.data?.length ? (
          <Empty />
        ) : (
          students.data.map((s) => (
            <div className="card" key={s.id}>
              <strong>{String(s.display_name)}</strong>
              <code>{s.id}</code>
            </div>
          ))
        )}
      </ResourceState>
      <form
        className="card form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            await api("teacher/assignments", "POST", {
              student_id: f.get("student_id"),
              title: f.get("title"),
              [kind]: f.get("content_id"),
              due_date: f.get("due_date") || null,
            });
            notify("saved");
            await assignments.load();
          });
        }}
      >
        <h2>{t("assignments")}</h2>
        <label className="field">
          {t("student_id")}
          <select className="input" name="student_id" required>
            {students.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {String(s.display_name)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("title")}
          <input className="input" name="title" maxLength={200} required />
        </label>
        <label className="field">
          {t("content")}
          <select
            className="input"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {[
              "test_id",
              "lesson_id",
              "writing_task_id",
              "speaking_task_id",
            ].map((k) => (
              <option key={k} value={k}>
                {t(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t(kind)}
          <select className="input" name="content_id" required>
            <option value="">{t("none")}</option>
            {library.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("due_date")}
          <input className="input" type="date" name="due_date" />
        </label>
        <button className="button primary">{t("assign")}</button>
      </form>
      <ResourceState {...assignments}>
        {assignments.data?.map((a) => (
          <div key={a.id} className="card">
            {a.title}
          </div>
        ))}
      </ResourceState>
      <ResourceState {...submissions}>
        {(["writing", "speaking"] as const).map((kind) => (
          <section key={kind}>
            <h2>{t(kind)}</h2>
            {!submissions.data?.[kind].length ? (
              <Empty />
            ) : (
              submissions.data[kind].map((s) => (
                <article className="card" key={s.id}>
                  <h3>{String((s[kind + "_tasks"] as Row)?.title || "")}</h3>
                  <code>{String(s.user_id)}</code>
                  {kind === "writing" ? (
                    <p className="preserve-text">{String(s.body)}</p>
                  ) : (
                    <PrivateMedia
                      path={String(s.storage_path)}
                      bucket="speaking"
                    />
                  )}
                  <button
                    className="button primary"
                    disabled={kind === "writing" && !s.submitted_at}
                    onClick={() => setReview({ row: s, kind })}
                  >
                    {t("review")}
                  </button>
                </article>
              ))
            )}
          </section>
        ))}
      </ResourceState>
      {review && (
        <form
          className="card form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const criteria = Object.fromEntries(
              (review.kind === "writing"
                ? ["task_response", "coherence", "lexical", "grammar"]
                : ["fluency", "lexical", "grammar", "pronunciation"]
              ).map((k) => [k, Number(f.get(k))]),
            );
            void run(async () => {
              await api("review", "POST", {
                kind: review.kind,
                id: review.row.id,
                band: 0,
                criteria,
                feedback: f.get("feedback"),
              });
              notify("saved");
              setReview(null);
              await submissions.load();
            });
          }}
        >
          <h2>{t("review")}</h2>
          {(review.kind === "writing"
            ? ["task_response", "coherence", "lexical", "grammar"]
            : ["fluency", "lexical", "grammar", "pronunciation"]
          ).map((k) => (
            <label className="field" key={k}>
              {t(k)}
              <input
                className="input"
                name={k}
                type="number"
                min={0}
                max={9}
                step={0.5}
                required
              />
            </label>
          ))}
          <label className="field">
            {t("feedback")}
            <textarea
              className="input"
              name="feedback"
              required
              maxLength={20000}
            />
          </label>
          <button className="button primary">{t("save")}</button>
        </form>
      )}
    </>
  );
}
