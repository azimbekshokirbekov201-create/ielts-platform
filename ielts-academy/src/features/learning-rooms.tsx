"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
export function Catalog({
  kind,
  skill,
  onSelect,
}: {
  kind: string;
  skill?: string;
  onSelect: (row: Row) => void;
}) {
  const { t } = useApp();
  const [page, setPage] = useState(0);
  const r = useResource<Row[]>(
    "catalog/" +
      kind +
      (skill ? "?skill=" + skill : "") +
      (page ? (skill ? "&" : "?") + "page=" + page : ""),
  );
  return (
    <ResourceState {...r}>
      {!r.data?.length ? (
        <Empty />
      ) : (
        <div className="live-grid">
          {r.data.map((row) => (
            <article className="card" key={row.id}>
              <h2>{row.title}</h2>
              <p>{row.variant ? t(String(row.variant)) : ""}</p>
              <button className="button primary" onClick={() => onSelect(row)}>
                {t("start")}
              </button>
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
  );
}
function Timer({
  deadline,
  onExpire,
}: {
  deadline: string;
  onExpire?: () => void;
}) {
  const { t } = useApp();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 1000)),
  );
  const callback = useRef(onExpire);
  const fired = useRef(false);
  useEffect(() => {
    callback.current = onExpire;
  }, [onExpire]);
  useEffect(() => {
    const update = () => {
      const n = Math.max(
        0,
        Math.ceil((Date.parse(deadline) - Date.now()) / 1000),
      );
      setRemaining(n);
      if (n === 0 && !fired.current) {
        fired.current = true;
        callback.current?.();
      }
    };
    const id = setInterval(update, 1000);
    update();
    return () => clearInterval(id);
  }, [deadline]);
  return (
    <span className="live-timer" role="timer">
      {t("time_left")} {Math.floor(remaining / 60)}:
      {String(remaining % 60).padStart(2, "0")}
    </span>
  );
}
export function PracticeRoom({
  skill,
  initialId,
  onComplete,
}: {
  skill: "listening" | "reading";
  initialId?: string;
  onComplete?: (id: string) => void;
}) {
  const { t, run } = useApp();
  const [test, setTest] = useState<Row | null>(null),
    [attempt, setAttempt] = useState<Row | null>(null),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [saved, setSaved] = useState("saved"),
    [busy, setBusy] = useState(false);
  const answersRef = useRef(answers);
  const dirty = useRef(false);
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function open(row: Row) {
    await run(async () => {
      const a = await api<Row>("attempts", "POST", { test_id: row.id });
      const full = await api<Row>("test/" + row.id);
      const resume = await api<Row>("attempts/" + a.id);
      setAnswers(
        Object.fromEntries(
          (resume.student_answers as Row[]).map((x) => [
            String(x.question_id),
            String(x.answer),
          ]),
        ),
      );
      setAttempt(resume);
      setTest(full);
    });
  }
  const initial = useRef(false);
  useEffect(() => {
    if (initialId && !initial.current) {
      initial.current = true;
      void open({ id: initialId });
    }
  }); // One load per mounted mock section.
  async function flush() {
    if (!attempt || !dirty.current) return;
    const snapshot = { ...answersRef.current };
    dirty.current = false;
    setSaved("saving");
    const job = pending.current.then(() =>
      api("attempts/" + attempt.id, "PATCH", { answers: snapshot }),
    );
    pending.current = job.catch(() => {});
    try {
      await job;
      setSaved("saved");
    } catch (e) {
      dirty.current = true;
      setSaved("operation_rejected");
      throw e;
    }
  }
  function change(id: string, value: string) {
    setAnswers((a) => {
      const next = { ...a, [id]: value };
      answersRef.current = next;
      return next;
    });
    dirty.current = true;
    setSaved("saving");
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => void run(flush), 650);
  }
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );
  async function submit(expired = false) {
    if (!attempt || busy || attempt.status === "submitted") return;
    setBusy(true);
    await run(async () => {
      if (timeout.current) clearTimeout(timeout.current);
      await pending.current;
      if (!expired) await flush();
      const r = await api<Row>(
        "attempts/" + attempt.id + "/submit",
        "POST",
        {},
      );
      setAttempt(r);
      onComplete?.(r.id);
    });
    setBusy(false);
  }
  if (!test || !attempt)
    return (
      <>
        <h1>{t(skill)}</h1>
        {!initialId && (
          <Catalog
            kind="tests"
            skill={skill}
            onSelect={(row) => void open(row)}
          />
        )}
      </>
    );
  if (attempt.status === "submitted")
    return (
      <article className="card">
        <h1>{test.title}</h1>
        <h2>
          {t("raw_score")}: {String(attempt.raw_score)}/
          {String(attempt.total_points)}
        </h2>
        {attempt.band !== null && (
          <p>
            {t("band")} {String(attempt.band)}
          </p>
        )}
        <p>{t("estimated")}</p>
        <Link href="/progress" className="button primary">
          {t("progress")}
        </Link>
      </article>
    );
  return (
    <>
      <div className="live-actions">
        <h1>{test.title}</h1>
        <Timer
          deadline={String(attempt.deadline)}
          onExpire={() => void submit(true)}
        />
        <span role="status">{t(saved)}</span>
      </div>
      <p>{t("autosave")}</p>
      {(test.test_sections as Row[])
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((section) => (
          <section className="card" key={section.id}>
            <h2>{section.title}</h2>
            {!!section.audio_path && (
              <PrivateMedia path={String(section.audio_path)} />
            )}
            <div className="exam-grid">
              <div>
                {(section.passages as Row[]).map((p) => (
                  <article key={p.id}>
                    <h3>{p.title}</h3>
                    <p className="preserve-text">{String(p.body)}</p>
                  </article>
                ))}
              </div>
              <div>
                {(section.questions as Row[])
                  .sort((a, b) => Number(a.position) - Number(b.position))
                  .map((q, i) => (
                    <label className="field" key={q.id}>
                      <span>
                        {i + 1}. {String(q.prompt)}
                      </span>
                      {q.kind === "choice" ||
                      q.kind === "matching" ||
                      q.kind === "true_false_not_given" ||
                      q.kind === "yes_no_not_given" ? (
                        <select
                          className="input"
                          value={answers[q.id] || ""}
                          onChange={(e) => change(q.id, e.target.value)}
                        >
                          <option value="">{t("none")}</option>
                          {(q.question_options as Row[]).map((o) => (
                            <option key={o.id} value={String(o.value)}>
                              {String(o.label)}
                            </option>
                          ))}
                          {!(q.question_options as Row[]).length &&
                            String(q.kind).includes("not_given") &&
                            (q.kind === "true_false_not_given"
                              ? ["TRUE", "FALSE", "NOT GIVEN"]
                              : ["YES", "NO", "NOT GIVEN"]
                            ).map((v) => <option key={v}>{v}</option>)}
                        </select>
                      ) : q.kind === "multiple_choice" ? (
                        <div className="live-choices">
                          {(q.question_options as Row[]).map((o) => {
                            const values = (answers[q.id] || "")
                              .split(",")
                              .filter(Boolean);
                            return (
                              <label key={o.id}>
                                <input
                                  type="checkbox"
                                  checked={values.includes(String(o.value))}
                                  onChange={(e) =>
                                    change(
                                      q.id,
                                      (e.target.checked
                                        ? [...values, String(o.value)]
                                        : values.filter((x) => x !== o.value)
                                      )
                                        .sort()
                                        .join(","),
                                    )
                                  }
                                />
                                {String(o.label)}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          className="input"
                          aria-label={t("answer") + " " + (i + 1)}
                          maxLength={4000}
                          value={answers[q.id] || ""}
                          onChange={(e) => change(q.id, e.target.value)}
                        />
                      )}
                    </label>
                  ))}
              </div>
            </div>
          </section>
        ))}
      <button
        className="button primary"
        disabled={busy}
        onClick={() => void submit()}
      >
        {t("submit")}
      </button>
    </>
  );
}
export function WritingRoom({
  initialId,
  onComplete,
}: {
  initialId?: string;
  onComplete?: (id: string) => void;
}) {
  const { t, run } = useApp();
  const [task, setTask] = useState<Row | null>(null),
    [draft, setDraft] = useState<Row | null>(null),
    [body, setBody] = useState(""),
    [saved, setSaved] = useState("saved"),
    [busy, setBusy] = useState(false);
  const initial = useRef(false);
  const edited = useRef(false);
  const latest = useRef("");
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  async function open(row: Row) {
    await run(async () => {
      const d = await api<Row>("writing", "POST", { task_id: row.id });
      setTask(row);
      setDraft(d);
      setBody(String(d.body));
      latest.current = String(d.body);
    });
  }
  useEffect(() => {
    if (initialId && !initial.current) {
      initial.current = true;
      void run(async () => {
        const selected = await api<Row>("task/writing_tasks/" + initialId);
        await open(selected);
      });
    }
  });
  useEffect(() => {
    if (!task || !draft || draft.submitted_at || !edited.current) return;
    const timer = setTimeout(() => {
      const snapshot = body;
      const job = pending.current.then(() =>
        api<Row>("writing", "POST", {
          task_id: task.id,
          submission_id: draft.id,
          body: snapshot,
        }),
      );
      pending.current = job.catch(() => {});
      void run(async () => {
        await job;
        setSaved("saved");
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [body, task, draft, run]);
  async function submit() {
    if (!task || busy || draft?.submitted_at) return;
    setBusy(true);
    await run(async () => {
      await pending.current;
      const d = await api<Row>("writing", "POST", {
        task_id: task.id,
        submission_id: draft?.id,
        body: latest.current,
        finish: true,
      });
      setDraft(d);
      setSaved("saved");
      onComplete?.(d.id);
    });
    setBusy(false);
  }
  if (!task || !draft)
    return (
      <>
        <h1>{t("writing")}</h1>
        {!initialId && (
          <Catalog kind="writing_tasks" onSelect={(row) => void open(row)} />
        )}
      </>
    );
  return (
    <section className="card">
      <h1>{task.title}</h1>
      <p className="preserve-text">{String(task.prompt)}</p>
      {!!task.image_path && (
        <PrivateMedia path={String(task.image_path)} image />
      )}
      {!draft.submitted_at && (
        <Timer
          deadline={String(draft.deadline)}
          onExpire={() => void submit()}
        />
      )}
      <label className="field">
        {t("answer")}
        <textarea
          className="input live-editor"
          value={body}
          maxLength={50000}
          disabled={!!draft.submitted_at}
          onChange={(e) => {
            setBody(e.target.value);
            latest.current = e.target.value;
            edited.current = true;
            setSaved("saving");
          }}
        />
      </label>
      <div className="live-actions">
        <span>
          {t("words")}: {body.trim() ? body.trim().split(/\s+/).length : 0}
        </span>
        <span role="status">{t(saved)}</span>
        {!draft.submitted_at && (
          <button
            className="button primary"
            disabled={busy || !body.trim()}
            onClick={() => void submit()}
          >
            {t("submit")}
          </button>
        )}
        {!!draft.submitted_at && (
          <Link href="/progress" className="text-link">
            {t("pending")} →
          </Link>
        )}
      </div>
    </section>
  );
}
export function SpeakingRoom({
  initialId,
  onComplete,
}: {
  initialId?: string;
  onComplete?: (id: string) => void;
}) {
  const { t, run, notify } = useApp();
  const [task, setTask] = useState<Row | null>(null),
    [recording, setRecording] = useState(false),
    [blob, setBlob] = useState<Blob | null>(null),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [preparing, setPreparing] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    initial = useRef(false);
  useEffect(() => {
    if (initialId && !initial.current) {
      initial.current = true;
      void run(async () => {
        setTask(await api<Row>("task/speaking_tasks/" + initialId));
      });
    }
  });
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    if (timer.current) clearTimeout(timer.current);
  }
  async function record() {
    try {
      if (!task) return;
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((x) =>
        MediaRecorder.isTypeSupported(x),
      );
      const r = new MediaRecorder(
        stream.current,
        type ? { mimeType: type } : undefined,
      );
      recorder.current = r;
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        setBlob(new Blob(chunks, { type: r.mimeType }));
        stream.current?.getTracks().forEach((t) => t.stop());
      };
      r.start();
      setRecording(true);
      timer.current = setTimeout(stop, Number(task.response_seconds) * 1000);
    } catch {
      notify("microphone_error");
    }
  }
  if (!task)
    return (
      <>
        <h1>{t("speaking")}</h1>
        {!initialId && <Catalog kind="speaking_tasks" onSelect={setTask} />}
      </>
    );
  return (
    <article className="card">
      <h1>{task.title}</h1>
      <p>
        {t("part")} {String(task.part)}
      </p>
      <p className="preserve-text">{String(task.prompt)}</p>
      <p>
        {t("preparation_seconds")}: {String(task.preparation_seconds)} ·{" "}
        {t("response_seconds")}: {String(task.response_seconds)}
      </p>
      {preparing && (
        <Timer
          deadline={preparing}
          onExpire={() => {
            setPreparing("");
            void record();
          }}
        />
      )}
      {recording ? (
        <button className="button destructive" onClick={stop}>
          {t("stop")}
        </button>
      ) : (
        <button
          className="button outline"
          disabled={busy || !!preparing}
          onClick={() =>
            Number(task.preparation_seconds) > 0
              ? setPreparing(
                  new Date(
                    Date.now() + Number(task.preparation_seconds) * 1000,
                  ).toISOString(),
                )
              : void record()
          }
        >
          {t("record")}
        </button>
      )}
      {url && <audio src={url} controls />}
      {blob && (
        <button
          className="button primary"
          disabled={busy || recording}
          onClick={() => {
            setBusy(true);
            void run(async () => {
              const upload = await uploadMedia(blob, "speaking");
              const row = await api<Row>("speaking", "POST", {
                task_id: task.id,
                path: upload.path,
              });
              notify("saved");
              setBlob(null);
              setUrl("");
              onComplete?.(row.id);
            }).finally(() => setBusy(false));
          }}
        >
          {t("submit")}
        </button>
      )}
    </article>
  );
}
export function MockRoom() {
  const { t, run } = useApp();
  const [exam, setExam] = useState<Row | null>(null),
    [attempt, setAttempt] = useState<Row | null>(null),
    [done, setDone] = useState<string[]>([]),
    [active, setActive] = useState<Row | null>(null);
  async function start(row: Row) {
    await run(async () => {
      const a = await api<Row>("mock", "POST", { exam_id: row.id });
      const e = await api<Row>("mock/" + row.id);
      const histories = await api<Row[]>("mock-results");
      const history = histories.find((x) => x.id === a.id);
      setDone(
        ((history?.mock_exam_results as Row[]) || []).map((x) =>
          String(x.section_id),
        ),
      );
      setAttempt(a);
      setExam(e);
    });
  }
  async function finished(id: string) {
    if (!active || !attempt) return;
    await run(async () => {
      await api("mock/" + attempt.id, "PATCH", {
        section_id: active.id,
        result_id: id,
      });
      setDone((d) => [...new Set([...d, active.id])]);
      setActive(null);
    });
  }
  if (!exam || !attempt)
    return (
      <>
        <h1>{t("mock")}</h1>
        <Catalog kind="mock_exams" onSelect={(r) => void start(r)} />
      </>
    );
  const sections = (exam.mock_exam_sections as Row[]).sort(
    (a, b) => Number(a.position) - Number(b.position),
  );
  return (
    <>
      <h1>{exam.title}</h1>
      <p>
        {done.length}/{sections.length} ·{" "}
        {t(done.length === sections.length ? "mock_pending" : "autosave")}
      </p>
      {active ? (
        <div key={active.id}>
          <button className="button outline" onClick={() => setActive(null)}>
            {t("back")}
          </button>
          <form
            className="card form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const id = String(new FormData(e.currentTarget).get("result_id"));
              void finished(id);
            }}
          >
            <label className="field">
              {t("result_id")}
              <input className="input" name="result_id" required />
            </label>
            <button className="button outline">{t("link_result")}</button>
          </form>
          {["listening", "reading"].includes(String(active.skill)) ? (
            <PracticeRoom
              skill={active.skill as "listening" | "reading"}
              initialId={String(active.test_id)}
              onComplete={(id) => void finished(id)}
            />
          ) : active.skill === "writing" ? (
            <WritingRoom
              initialId={String(active.writing_task_id)}
              onComplete={(id) => void finished(id)}
            />
          ) : (
            <SpeakingRoom
              initialId={String(active.speaking_task_id)}
              onComplete={(id) => void finished(id)}
            />
          )}
        </div>
      ) : (
        sections.map((s, i) => (
          <article key={s.id} className="card">
            <h2>{t(String(s.skill))}</h2>
            <button
              className="button primary"
              disabled={
                done.includes(s.id) ||
                (i > 0 && !done.includes(sections[i - 1].id))
              }
              onClick={() => setActive(s)}
            >
              {t(done.includes(s.id) ? "completed" : "start")}
            </button>
          </article>
        ))
      )}
    </>
  );
}
