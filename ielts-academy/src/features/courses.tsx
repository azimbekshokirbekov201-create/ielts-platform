"use client";
import { RichTextView } from "./rich-text";
import { PremiumLock } from "./subscriptions";
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Check, Play } from "lucide-react";
import { Card, Badge, Progress } from "@/components/ui/primitives";
import { api, type Row } from "@/lib/api";
import {
  useApp,
  useResource,
  ResourceState,
  Empty,
  PageControls,
} from "./academy-context";
import { PrivateMedia } from "./academy";
export function Courses() {
  const { t, run, notify } = useApp();
  const [page, setPage] = useState(0);
  const catalog = useResource<Row[]>(
    "catalog/courses" + (page ? "?page=" + page : ""),
  );
  const progress = useResource<Record<string, Row[]>>("dashboard");
  const [selected, setSelected] = useState<Row | null>(null);
  const [lesson, setLesson] = useState<Row | null>(null);
  const lessons = (course: Row) =>
    ((course.course_modules as Row[]) || [])
      .sort((a, b) => Number(a.position) - Number(b.position))
      .flatMap((m) =>
        ((m.lessons as Row[]) || []).sort(
          (a, b) => Number(a.position) - Number(b.position),
        ),
      );
  async function open(id: string) {
    await run(async () => {
      const c = await api<Row>("course/" + id);
      setSelected(c);
      setLesson(lessons(c)[0] || null);
    });
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("course");
    if (id)
      void api<Row>("course/" + id)
        .then((c) => {
          setSelected(c);
          setLesson(lessons(c)[0] || null);
        })
        .catch(() => {});
  }, []);
  async function enroll(id: string) {
    await run(async () => {
      await api("enroll", "POST", { course_id: id });
      await progress.load();
      notify("saved");
    });
  }
  if (selected) {
    const all = lessons(selected);
    const completed = progress.data?.lesson_progress || [];
    const count = all.filter((l) =>
      completed.some((x) => x.lesson_id === l.id),
    ).length;
    const enrolled = progress.data?.course_enrollments.some(
      (x) => x.course_id === selected.id,
    );
    return (
      <>
        <button
          className="button ghost back-button"
          onClick={() => {
            setSelected(null);
            setLesson(null);
          }}
        >
          <ArrowLeft size={15} />
          Back to courses
        </button>
        <div className="page-heading">
          <div>
            <div className="eyebrow">A LITTLE MORE CONFIDENCE</div>
            <h1>{selected.title}</h1>
            <p>{String(selected.description || "")}</p>
          </div>
          <Badge color="blue">{enrolled ? "ENROLLED" : "COURSE PREVIEW"}</Badge>
        </div>
        <div className="course-workspace">
          <Card className="course-outline">
            <h3>Your learning path</h3>
            <Progress
              value={all.length ? (count / all.length) * 100 : 0}
              label="Course progress"
            />
            <p>
              {count} of {all.length} lessons complete
            </p>
            {all.map((l, i) => (
              <button
                key={l.id}
                className={
                  "lesson-link " + (lesson?.id === l.id ? "active" : "")
                }
                onClick={() => setLesson(l)}
              >
                <span>
                  {completed.some((x) => x.lesson_id === l.id) ? (
                    <Check size={15} />
                  ) : (
                    i + 1
                  )}
                </span>
                {l.title}
              </button>
            ))}
            {!all.length && <Empty />}
          </Card>
          <Card className="lesson-viewer">
            {lesson ? (
              <>
                <div className="eyebrow">YOUR NEXT STEP</div>
                <h2>{lesson.title}</h2>
                <RichTextView text={String(lesson.body || "")} />
                {!!lesson.video_url && (
                  <PrivateMedia path={String(lesson.video_url)} video />
                )}
                {((lesson.lesson_resources as Row[]) || []).map((a) => (
                  <PrivateMedia
                    key={a.id}
                    path={String(a.storage_path)}
                    label={a.title}
                  />
                ))}
                <div className="live-actions">
                  {enrolled ? (
                    <button
                      className="button primary"
                      onClick={() =>
                        void run(async () => {
                          await api("complete", "POST", {
                            lesson_id: lesson.id,
                          });
                          await progress.load();
                          notify("saved");
                        })
                      }
                    >
                      <Check size={17} />
                      {t("complete")}
                    </button>
                  ) : (
                    <button
                      className="button primary"
                      onClick={() => void enroll(selected.id)}
                    >
                      {t("enroll")}
                      <ArrowUpRight size={16} />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <Empty />
            )}
          </Card>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> LEARN A LITTLE. GROW A LOT.
          </div>
          <h1>{t("courses")}</h1>
          <p>Considered lessons for your next chapter.</p>
        </div>
        <Badge color="blue">YOUR LEARNING LIBRARY</Badge>
      </div>
      <ResourceState {...catalog}>
        {catalog.data?.length ? (
          <div className="course-grid">
            {catalog.data.map((c, i) => {
              const color = ["blue", "purple", "orange", "green"][i % 4];
              return (
                <Card className="course-catalog-card" key={c.id}>
                  <div className={"course-art " + color}>
                    <span>
                      <BookOpen size={44} />
                    </span>
                    <small>MAKE ROOM FOR YOUR POTENTIAL</small>
                  </div>
                  <div className="course-card-body">
                    {!!c.locked && <PremiumLock />}
                    <Badge color={color}>IELTS ACADEMY</Badge>
                    <h3>{c.title}</h3>
                    <p>{String(c.description || "")}</p>
                    <div className="live-actions">
                      <button
                        className="button outline"
                        disabled={!!c.locked}
                        onClick={() => void open(c.id)}
                      >
                        <Play size={15} />
                        {t("preview")}
                      </button>
                      <button
                        className="button primary"
                        disabled={!!c.locked}
                        onClick={() => void enroll(c.id)}
                      >
                        {t("enroll")}
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="premium-empty">
            <BookOpen size={32} />
            <Empty />
          </Card>
        )}
        <PageControls
          page={page}
          onChange={setPage}
          count={catalog.data?.length || 0}
        />
      </ResourceState>
    </>
  );
}
