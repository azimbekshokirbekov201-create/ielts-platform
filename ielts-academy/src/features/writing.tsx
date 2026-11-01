"use client";
import { useState, useRef, useEffect } from "react";
import {
  PenLine,
  Maximize2,
  Minimize2,
  Bold,
  Italic,
  List,
  CheckCircle2,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { useAcademy } from "@/store/use-academy";
import { wordCount } from "@/lib/grading";
import {
  Card,
  Badge,
  Tabs,
  Modal,
  Progress,
  EmptyState,
} from "@/components/ui/primitives";
import { TestTimer } from "@/components/test-timer";
import type { Attempt } from "@/types";
export function Writing({
  exam = false,
  onComplete,
}: {
  exam?: boolean;
  onComplete?: (attempt: Attempt) => void;
}) {
  const [task, setTask] = useState("Task 2");
  const [fullscreen, setFullscreen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [result, setResult] = useState<Attempt | null>(null);
  const [expired, setExpired] = useState(false);
  const [timeStarted, setTimeStarted] = useState(exam);
  const [view, setView] = useState("Workspace");
  const editor = useRef<HTMLDivElement>(null);
  const store = useAcademy();
  const key = `${exam ? "exam-" : ""}writing-${task}`;
  const text = store.drafts[key] ?? "";
  const words = wordCount(text);
  useEffect(() => {
    if (
      editor.current &&
      editor.current.innerHTML !== (store.drafts[key] ?? "")
    )
      editor.current.innerHTML = store.drafts[key] ?? "";
  }, [key, store.drafts]);
  const submit = () => {
    const a: Attempt = {
      id: crypto.randomUUID(),
      skill: "writing",
      title: `Writing · ${task}`,
      date: new Date().toISOString(),
      text,
      feedback,
      status: feedback ? "Demo feedback" : "Awaiting evaluation",
      band: feedback ? 6.5 : undefined,
    };
    store.addAttempt(a);
    setResult(a);
    setConfirm(false);
    onComplete?.(a);
  };
  if (result)
    return (
      <div>
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR IDEAS, ON THE PAGE</div>
            <h1>
              {result.feedback
                ? "A fresh look at your writing."
                : "Your writing is safely saved."}
            </h1>
            <p>
              {result.feedback
                ? "Fixed example feedback. It does not evaluate the submitted essay."
                : "Awaiting evaluation · no AI or teacher evaluation has been performed."}
            </p>
          </div>
          <button
            className="button outline"
            onClick={() => {
              setResult(null);
              setView("Workspace");
            }}
          >
            <RotateCcw size={15} />
            Back to writing
          </button>
        </div>
        {result.feedback ? (
          <Feedback kind="writing" />
        ) : (
          <Card>
            <CheckCircle2 size={32} className="text-green" />
            <h2>Awaiting evaluation</h2>
            <p>
              Your {wordCount(result.text ?? "")} words are saved locally. A
              future teacher or AI integration can evaluate this response.
            </p>
            <button
              className="button secondary"
              onClick={() => setResult({ ...result, feedback: true })}
            >
              Explore explicitly labeled demo feedback
            </button>
          </Card>
        )}
        <Card className="submitted-text">
          <h3>Your submitted response</h3>
          <p>{(result.text ?? "").replace(/<[^>]*>/g, " ")}</p>
        </Card>
      </div>
    );
  return (
    <div className={fullscreen ? "writing-fullscreen" : ""}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE WRITING STUDIO</div>
          <h1>Make room for your ideas.</h1>
          <p>Find your flow. Give your words a little space.</p>
        </div>
        <button
          className="button outline"
          onClick={() => setFullscreen((v) => !v)}
        >
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{" "}
          {fullscreen ? "Exit focus mode" : "Focus mode"}
        </button>
      </div>
      <div className="practice-toolbar">
        <Tabs
          items={["Academic Task 1", "General Training Task 1", "Task 2"]}
          value={task}
          onChange={(v) => {
            setTask(v);
            setExpired(false);
            setTimeStarted(false);
          }}
        />
        <Tabs
          items={["Workspace", "History"]}
          value={view}
          onChange={setView}
        />
      </div>
      {view === "History" ? (
        <Card>
          <h2>Your writing, over time</h2>
          {store.attempts.filter((a) => a.skill === "writing").length ? (
            store.attempts
              .filter((a) => a.skill === "writing")
              .map((a) => (
                <button
                  key={a.id}
                  className="history-row"
                  onClick={() => setResult(a)}
                >
                  <PenLine size={19} />
                  <span>
                    {a.title}
                    <small>
                      {new Date(a.date).toLocaleString()} ·{" "}
                      {wordCount(a.text ?? "")} words
                    </small>
                  </span>
                  <Badge color="slate">{a.status}</Badge>
                  <ArrowRight size={16} />
                </button>
              ))
          ) : (
            <EmptyState
              title="A blank page is a beginning"
              description="Your submitted writing will appear here."
            />
          )}
        </Card>
      ) : (
        <div className="writing-workspace">
          <Card className="writing-prompt">
            <Badge color="orange">{task.toUpperCase()}</Badge>
            <h2>
              {task === "Task 2"
                ? "A place to call home"
                : task === "Academic Task 1"
                  ? "A greener commute"
                  : "A letter to your community"}
            </h2>
            <p>
              {task === "Task 2"
                ? "Some people believe living in a city offers a better quality of life, while others prefer living in the countryside. Discuss both views and give your own opinion."
                : task === "Academic Task 1"
                  ? "The chart shows how residents in a fictional town travelled to work in 2010 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant."
                  : "You recently attended a community workshop. Write a letter to the organiser. Describe what you enjoyed, explain a problem you experienced, and suggest an improvement."}
            </p>
            {task === "Academic Task 1" && (
              <div
                className="prompt-chart"
                aria-label="Transport share: Car 60% in 2010 and 40% in 2025; Bus 25% and 30%; Bicycle 15% and 30%."
              >
                <div className="chart-legend">
                  <span>
                    <i className="blue" />
                    2010
                  </span>
                  <span>
                    <i className="green" />
                    2025
                  </span>
                </div>
                {[
                  { name: "Car", a: 60, b: 40 },
                  { name: "Bus", a: 25, b: 30 },
                  { name: "Bicycle", a: 15, b: 30 },
                ].map((d) => (
                  <div key={d.name}>
                    <strong>{d.name}</strong>
                    <div style={{ width: `${d.a}%` }}>{d.a}%</div>
                    <div style={{ width: `${d.b}%`, background: "#43a68e" }}>
                      {d.b}%
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="notice">
              Write at least {task === "Task 2" ? 250 : 150} words. Aim to spend{" "}
              {task === "Task 2" ? 40 : 20} minutes on this task.
            </div>
            <h4>A little guidance</h4>
            <ul className="check-list">
              <li>
                <CheckCircle2 size={15} />
                Take a moment to plan
              </li>
              <li>
                <CheckCircle2 size={15} />
                Develop each main idea
              </li>
              <li>
                <CheckCircle2 size={15} />
                Leave time to read it through
              </li>
            </ul>
          </Card>
          <Card className="editor-card">
            <div className="editor-toolbar">
              <div>
                {[
                  { label: "Bold", cmd: "bold", icon: Bold },
                  { label: "Italic", cmd: "italic", icon: Italic },
                  {
                    label: "Bullet list",
                    cmd: "insertUnorderedList",
                    icon: List,
                  },
                ].map((c) => (
                  <button
                    className="icon-button"
                    key={c.cmd}
                    aria-label={c.label}
                    disabled={expired}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor.current?.focus();
                      document.execCommand(c.cmd);
                    }}
                  >
                    <c.icon size={17} />
                  </button>
                ))}
              </div>
              {timeStarted || !!store.drafts[`timer-${key}`] ? (
                <TestTimer
                  id={key}
                  minutes={task === "Task 2" ? 40 : 20}
                  onExpire={() => setExpired(true)}
                />
              ) : (
                <button
                  className="button ghost small"
                  onClick={() => setTimeStarted(true)}
                >
                  Start timer
                </button>
              )}
            </div>
            {expired && (
              <p className="notice" role="status">
                Time is up. Submit your saved response to finish.
              </p>
            )}
            <div
              ref={editor}
              role="textbox"
              aria-label="Your writing response"
              aria-multiline="true"
              className="rich-editor"
              contentEditable={!expired}
              suppressContentEditableWarning
              data-placeholder="Every good essay starts with a first thought…"
              onInput={(e) => store.draft(key, e.currentTarget.innerHTML)}
            />
            <div className="editor-status">
              <span>
                {words} / {task === "Task 2" ? 250 : 150} words
              </span>
              <span>
                <CheckCircle2 size={13} />
                Saved locally
              </span>
            </div>
            <Progress
              value={Math.min(
                100,
                (words / (task === "Task 2" ? 250 : 150)) * 100,
              )}
              label="Suggested word count progress"
            />
            <div className="editor-actions">
              <button
                className="button outline small"
                onClick={() => {
                  const previous = store.attempts.find(
                    (a) => a.skill === "writing" && a.title.endsWith(task),
                  );
                  if (previous) {
                    store.draft(key, previous.text ?? "");
                  } else {
                    store.draft(key, text);
                  }
                }}
              >
                Recover latest submission
              </button>
              <button
                className="button primary"
                disabled={!words}
                onClick={() => setConfirm(true)}
              >
                Submit writing <ArrowRight size={15} />
              </button>
            </div>
            <p className="caption">
              Drafts are restored automatically. Recovery replaces the editor
              with your latest submitted version, if one exists.
            </p>
          </Card>
        </div>
      )}
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Ready to save your response?"
        description={`Your ${words}-word response will be added to your local writing history.`}
      >
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={feedback}
            onChange={(e) => setFeedback(e.target.checked)}
          />
          Show fixed demo feedback (not an evaluation of my writing)
        </label>
        <div className="notice">
          Without this option, the response is marked “Awaiting evaluation”. No
          text is sent to an AI service.
        </div>
        <div className="dialog-actions">
          <button className="button outline" onClick={() => setConfirm(false)}>
            Keep writing
          </button>
          <button className="button primary" onClick={submit}>
            Save submission
          </button>
        </div>
      </Modal>
    </div>
  );
}
export function Feedback({ kind }: { kind: "writing" | "speaking" }) {
  const criteria =
    kind === "writing"
      ? [
          "Task Response / Achievement",
          "Coherence and Cohesion",
          "Lexical Resource",
          "Grammatical Range and Accuracy",
        ]
      : [
          "Fluency and Coherence",
          "Lexical Resource",
          "Grammatical Range and Accuracy",
          "Pronunciation",
        ];
  return (
    <>
      <div className="notice demo-feedback">
        <strong>DEMO FEEDBACK · FIXED EXAMPLE</strong>
        <p>
          This is illustrative feedback and does not analyse your{" "}
          {kind === "writing" ? "essay" : "recording"}. No AI or human
          evaluation has occurred.
        </p>
      </div>
      <div className="feedback-grid">
        <Card className="feedback-overall">
          <p>Illustrative band</p>
          <strong>6.5</strong>
          <Badge color="orange">DEMO ONLY</Badge>
        </Card>
        <Card>
          {criteria.map((c, i) => (
            <div className="criterion" key={c}>
              <div>
                <span>{c}</span>
                <strong>{[7, 6.5, 6, 6.5][i].toFixed(1)}</strong>
              </div>
              <Progress
                value={[77, 72, 66, 72][i]}
                label={`${c} illustrative band`}
              />
            </div>
          ))}
        </Card>
      </div>
      <div className="two-columns">
        <Card>
          <Badge color="green">EXAMPLE STRENGTHS</Badge>
          <h3>A clear central idea</h3>
          <p>
            A focused position and a logical order can help a reader follow an
            argument.
          </p>
          <h4>Try next</h4>
          <p>
            Develop one concrete example for each main point. Explain why it
            supports your view.
          </p>
        </Card>
        <Card>
          <Badge color="orange">EXAMPLE AREAS TO DEVELOP</Badge>
          <h3>More precise expression</h3>
          <p>
            Choose specific vocabulary, check sentence boundaries, and vary
            sentence structure.
          </p>
          <h4>Illustrative grammar correction</h4>
          <p>
            <del>People is more happier.</del>
            <br />
            <strong>People are happier.</strong>
          </p>
          <p className="caption">
            This invented example is not taken from your response.
          </p>
        </Card>
      </div>
    </>
  );
}
