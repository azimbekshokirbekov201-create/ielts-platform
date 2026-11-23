"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type Row } from "@/lib/api";
import { RichEditor } from "./rich-text";
import { FileUpload } from "./file-upload";
import { useApp, useResource, ResourceState } from "./academy-context";

const byPosition = (a: Row, b: Row) => Number(a.position) - Number(b.position);
const content = (path: string) => "admin/content/" + path;

type LessonValues = {
  title: string;
  body: string;
  video_url: string;
  status: string;
  access_tier: string;
};
function LessonForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Row;
  onSave: (v: LessonValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const { t } = useApp();
  const [v, setV] = useState<LessonValues>({
    title: String(initial?.title ?? ""),
    body: String(initial?.body ?? ""),
    video_url: String(initial?.video_url ?? ""),
    status: String(initial?.status ?? "draft"),
    access_tier: String(initial?.access_tier ?? "premium"),
  });
  const set = (k: keyof LessonValues, value: string) =>
    setV((x) => ({ ...x, [k]: value }));
  return (
    <form
      className="card form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(v);
      }}
    >
      <label className="field">
        {t("title")}
        <input
          className="input"
          value={v.title}
          maxLength={200}
          required
          onChange={(e) => set("title", e.target.value)}
        />
      </label>
      <div className="field">
        {t("body")}
        <RichEditor
          label={t("body")}
          value={v.body}
          onChange={(x) => set("body", x)}
        />
      </div>
      <div className="field">
        {t("video_url")}
        <input
          className="input"
          value={v.video_url}
          onChange={(e) => set("video_url", e.target.value)}
        />
        <FileUpload value={v.video_url} onChange={(x) => set("video_url", x)} />
      </div>
      <label className="field">
        {t("status")}
        <select
          className="input"
          value={v.status}
          onChange={(e) => set("status", e.target.value)}
        >
          {["draft", "published", "archived"].map((x) => (
            <option key={x} value={x}>
              {t(x)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {t("access_tier")}
        <select
          className="input"
          value={v.access_tier}
          onChange={(e) => set("access_tier", e.target.value)}
        >
          {["free", "premium"].map((x) => (
            <option key={x} value={x}>
              {t(x)}
            </option>
          ))}
        </select>
      </label>
      <div className="live-actions">
        <button className="button primary">{t("save")}</button>
        <button type="button" className="button outline" onClick={onCancel}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}

function LessonFiles({
  lesson,
  act,
}: {
  lesson: Row;
  act: (job: () => Promise<unknown>) => Promise<void>;
}) {
  const { t } = useApp();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  return (
    <div className="card">
      <h4>{t("cb_resources")}</h4>
      {((lesson.lesson_resources as Row[]) || []).map((f) => (
        <div className="live-actions" key={f.id}>
          <span>{String(f.title)}</span>
          <button
            className="button ghost"
            onClick={() =>
              void act(() => api(content("lesson_resources/" + f.id), "DELETE"))
            }
          >
            {t("remove")}
          </button>
        </div>
      ))}
      <input
        className="input"
        aria-label={t("title")}
        placeholder={t("title")}
        value={name}
        maxLength={200}
        onChange={(e) => setName(e.target.value)}
      />
      <FileUpload value={path} onChange={setPath} />
      <button
        className="button outline"
        disabled={!name.trim() || !path}
        onClick={() =>
          void act(async () => {
            await api(content("lesson_resources"), "POST", {
              lesson_id: lesson.id,
              title: name.trim(),
              storage_path: path,
            });
            setName("");
            setPath("");
          })
        }
      >
        {t("cb_add_file")}
      </button>
    </div>
  );
}

export function CourseBuilder() {
  const { t, run, notify } = useApp();
  const courses = useResource<Row[]>(content("courses"));
  const [courseId, setCourseId] = useState("");
  const [tree, setTree] = useState<Row | null>(null);
  const [newCourse, setNewCourse] = useState("");
  const [newModule, setNewModule] = useState("");
  // "lesson-id" edits a lesson, "new:module-id" adds one to that module
  const [open, setOpen] = useState("");
  const load = useCallback(async (id: string) => {
    setTree(id ? await api<Row>("course/" + id) : null);
  }, []);
  useEffect(() => {
    void run(() => load(courseId));
  }, [courseId, load, run]);
  const act = useCallback(
    async (job: () => Promise<unknown>) => {
      await run(async () => {
        await job();
        await load(courseId);
        notify("saved");
      });
    },
    [run, load, courseId, notify],
  );
  const modules = ((tree?.course_modules as Row[]) || [])
    .slice()
    .sort(byPosition);
  // Re-number positions 0..n-1 so moving works even when old rows share a position.
  async function move(list: Row[], index: number, dir: -1 | 1, table: string) {
    const next = list.slice();
    const to = index + dir;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    for (const [i, row] of next.entries())
      if (Number(row.position) !== i)
        await api(content(table + "/" + row.id), "PATCH", { position: i });
  }
  async function removeModule(m: Row) {
    for (const l of (m.lessons as Row[]) || []) {
      for (const f of (l.lesson_resources as Row[]) || [])
        await api(content("lesson_resources/" + f.id), "DELETE");
      await api(content("lessons/" + l.id), "DELETE");
    }
    await api(content("course_modules/" + m.id), "DELETE");
  }
  return (
    <section>
      <h2>{t("course_builder")}</h2>
      <div className="card form-stack">
        <label className="field">
          {t("cb_pick")}
          <select
            className="input"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setOpen("");
            }}
          >
            <option value="">{t("none")}</option>
            {courses.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {String(c.title)}
              </option>
            ))}
          </select>
        </label>
        <form
          className="live-actions"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const created = await api<Row>(content("courses"), "POST", {
                title: newCourse.trim(),
                description: "",
                status: "draft",
                access_tier: "premium",
              });
              setNewCourse("");
              await courses.load();
              setCourseId(created.id);
              notify("saved");
            });
          }}
        >
          <input
            className="input"
            placeholder={t("cb_new")}
            aria-label={t("cb_new")}
            value={newCourse}
            maxLength={200}
            required
            onChange={(e) => setNewCourse(e.target.value)}
          />
          <button className="button primary">{t("create")}</button>
        </form>
      </div>
      <ResourceState {...courses}>
        {tree && (
          <>
            <form
              key={String(tree.id) + String(tree.updated_at)}
              className="card form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                void act(async () => {
                  await api(content("courses/" + tree.id), "PATCH", {
                    title: f.title,
                    status: f.status,
                    access_tier: f.access_tier,
                  });
                  await courses.load();
                });
              }}
            >
              <h3>{t("cb_course_settings")}</h3>
              <label className="field">
                {t("title")}
                <input
                  className="input"
                  name="title"
                  defaultValue={String(tree.title)}
                  maxLength={200}
                  required
                />
              </label>
              <label className="field">
                {t("status")}
                <select
                  className="input"
                  name="status"
                  defaultValue={String(tree.status)}
                >
                  {["draft", "published", "archived"].map((x) => (
                    <option key={x} value={x}>
                      {t(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t("access_tier")}
                <select
                  className="input"
                  name="access_tier"
                  defaultValue={String(tree.access_tier || "premium")}
                >
                  {["free", "premium"].map((x) => (
                    <option key={x} value={x}>
                      {t(x)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button primary">{t("save")}</button>
            </form>
            {!modules.length && <p className="notice">{t("cb_empty")}</p>}
            {modules.map((m, mi) => {
              const lessons = ((m.lessons as Row[]) || [])
                .slice()
                .sort(byPosition);
              return (
                <article className="card" key={m.id}>
                  <div className="live-actions">
                    <input
                      className="input"
                      aria-label={t("cb_module")}
                      defaultValue={String(m.title)}
                      maxLength={200}
                      onBlur={(e) => {
                        const title = e.target.value.trim();
                        if (title && title !== m.title)
                          void act(() =>
                            api(content("course_modules/" + m.id), "PATCH", {
                              title,
                            }),
                          );
                      }}
                    />
                    <button
                      className="button outline"
                      disabled={mi === 0}
                      onClick={() =>
                        void act(() => move(modules, mi, -1, "course_modules"))
                      }
                    >
                      {t("cb_up")}
                    </button>
                    <button
                      className="button outline"
                      disabled={mi === modules.length - 1}
                      onClick={() =>
                        void act(() => move(modules, mi, 1, "course_modules"))
                      }
                    >
                      {t("cb_down")}
                    </button>
                    <button
                      className="button ghost"
                      onClick={() =>
                        window.confirm(t("cb_confirm_module")) &&
                        void act(() => removeModule(m))
                      }
                    >
                      {t("remove")}
                    </button>
                  </div>
                  {lessons.map((l, li) => (
                    <div key={l.id}>
                      <div className="live-actions">
                        <strong>{String(l.title)}</strong>
                        <span className="badge">{t(String(l.status))}</span>
                        <button
                          className="button outline"
                          disabled={li === 0}
                          onClick={() =>
                            void act(() => move(lessons, li, -1, "lessons"))
                          }
                        >
                          {t("cb_up")}
                        </button>
                        <button
                          className="button outline"
                          disabled={li === lessons.length - 1}
                          onClick={() =>
                            void act(() => move(lessons, li, 1, "lessons"))
                          }
                        >
                          {t("cb_down")}
                        </button>
                        <button
                          className="button outline"
                          onClick={() => setOpen(open === l.id ? "" : l.id)}
                        >
                          {t("edit")}
                        </button>
                        <button
                          className="button ghost"
                          onClick={() =>
                            window.confirm(t("confirm_delete")) &&
                            void act(async () => {
                              for (const f of (l.lesson_resources as Row[]) ||
                                [])
                                await api(
                                  content("lesson_resources/" + f.id),
                                  "DELETE",
                                );
                              await api(content("lessons/" + l.id), "DELETE");
                            })
                          }
                        >
                          {t("remove")}
                        </button>
                      </div>
                      {open === l.id && (
                        <>
                          <LessonForm
                            initial={l}
                            onCancel={() => setOpen("")}
                            onSave={(v) =>
                              act(async () => {
                                await api(content("lessons/" + l.id), "PATCH", {
                                  ...v,
                                  video_url: v.video_url || null,
                                });
                                setOpen("");
                              })
                            }
                          />
                          <LessonFiles lesson={l} act={act} />
                        </>
                      )}
                    </div>
                  ))}
                  {open === "new:" + m.id ? (
                    <LessonForm
                      onCancel={() => setOpen("")}
                      onSave={(v) =>
                        act(async () => {
                          await api(content("lessons"), "POST", {
                            ...v,
                            video_url: v.video_url || null,
                            module_id: m.id,
                            position: lessons.length,
                          });
                          setOpen("");
                        })
                      }
                    />
                  ) : (
                    <button
                      className="button outline"
                      onClick={() => setOpen("new:" + m.id)}
                    >
                      + {t("cb_add_lesson")}
                    </button>
                  )}
                </article>
              );
            })}
            <form
              className="live-actions"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await api(content("course_modules"), "POST", {
                    course_id: tree.id,
                    title: newModule.trim(),
                    position: modules.length,
                  });
                  setNewModule("");
                });
              }}
            >
              <input
                className="input"
                placeholder={t("cb_module")}
                aria-label={t("cb_module")}
                value={newModule}
                maxLength={200}
                required
                onChange={(e) => setNewModule(e.target.value)}
              />
              <button className="button primary">{t("cb_add_module")}</button>
            </form>
          </>
        )}
      </ResourceState>
    </section>
  );
}
