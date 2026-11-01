"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Highlighter,
  StickyNote,
  RotateCcw,
  BookOpen,
  Headphones,
} from "lucide-react";
import { useAcademy } from "@/store/use-academy";
import {
  listeningQuestions,
  readingQuestions,
  passage,
  listeningScript,
} from "@/data/content";
import { grade, normalize } from "@/lib/grading";
import { Card, Badge, Modal, Tabs, Progress } from "@/components/ui/primitives";
import { QuestionCard } from "@/components/question-card";
import { TestTimer } from "@/components/test-timer";
import { AudioPlayer } from "@/components/listening/audio-player";
import type { Attempt } from "@/types";
export function Practice({
  skill,
  exam = false,
  onComplete,
  examMode,
}: {
  skill: "listening" | "reading";
  exam?: boolean;
  onComplete?: (attempt: Attempt) => void;
  examMode?: string;
}) {
  const [started, setStarted] = useState(exam);
  const [section, setSection] = useState(1);
  const [mode, setMode] = useState(examMode ?? "Academic");
  const [result, setResult] = useState<Attempt | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [limit, setLimit] = useState(20);
  const store = useAcademy();
  const key = `${exam ? "exam-" : ""}${skill}-${mode}`;
  const answers = store.answers[key] ?? {};
  const questions =
    skill === "listening" ? listeningQuestions : readingQuestions;
  const count = questions.filter((q) => answers[q.id]?.trim()).length;
  const submit = () => {
    const a: Attempt = {
      id: crypto.randomUUID(),
      skill,
      title: `${mode} ${skill} · original sample`,
      date: new Date().toISOString(),
      ...grade(questions, answers),
      answers,
      status: "Completed",
    };
    store.addAttempt(a);
    setResult(a);
    setConfirm(false);
    onComplete?.(a);
  };
  if (result)
    return (
      <div className="results">
        <div className="page-heading">
          <div>
            <div className="eyebrow">A STEP FORWARD</div>
            <h1>Practice, reflected.</h1>
            <p>Here’s what you can take into your next session.</p>
          </div>
          <Badge color="green">COMPLETED</Badge>
        </div>
        <Card className="result-hero">
          <CheckCircle2 size={40} />
          <div>
            <p>Estimated sample band</p>
            <strong>{result.band?.toFixed(1)}</strong>
            <p>
              {result.score} of {result.total} correct
            </p>
          </div>
          <div className="notice">
            This short sample is for practice. Band estimates use an
            illustrative percentage mapping, not an official IELTS conversion or
            prediction.
          </div>
        </Card>
        <div className="section-heading">
          <h2>Make every answer a learning moment</h2>
          <button
            className="button outline"
            onClick={() => {
              setResult(null);
              setStarted(false);
              store.draft(`timer-${key}`, "");
              setTimedOut(false);
            }}
          >
            <RotateCcw size={15} />
            Practice again
          </button>
        </div>
        {questions.map((q, i) => {
          const correct =
            normalize(result.answers?.[q.id] ?? "") === normalize(q.answer);
          return (
            <Card
              key={q.id}
              className={`review-card ${correct ? "correct" : "incorrect"}`}
            >
              <div>
                <span className="question-number">{i + 1}</span>
                <h3>{q.text}</h3>
                <Badge color={correct ? "green" : "orange"}>
                  {correct ? "Correct" : "Review"}
                </Badge>
              </div>
              <p>
                Your answer:{" "}
                <strong>{result.answers?.[q.id] || "Not answered"}</strong> ·
                Correct answer: <strong>{q.answer}</strong>
              </p>
              <p>{q.explanation}</p>
            </Card>
          );
        })}
      </div>
    );
  if (!started)
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">MAKE ROOM FOR PRACTICE</div>
            <h1>
              {skill === "reading"
                ? "A new perspective, every passage."
                : "Good listening starts with curiosity."}
            </h1>
            <p>Original, bite-sized exercises. A little more confidence.</p>
          </div>
          <span
            className={`skill-icon large ${skill === "reading" ? "purple" : "blue"}`}
          >
            {skill === "reading" ? <BookOpen /> : <Headphones />}
          </span>
        </div>
        {skill === "reading" && (
          <Tabs
            items={["Academic", "General Training"]}
            value={mode}
            onChange={setMode}
          />
        )}
        <div className="practice-selection">
          <Card className="test-selection-card">
            <div
              className={`test-cover ${skill === "reading" ? "purple" : "blue"}`}
            >
              <span>
                {skill === "reading"
                  ? "A garden.\nA community."
                  : "Listen.\nDiscover."}
              </span>
              <i aria-hidden="true">{skill === "reading" ? "Aa" : "◉"}</i>
            </div>
            <div className="test-details">
              <Badge color={skill === "reading" ? "purple" : "blue"}>
                ORIGINAL SAMPLE · {mode.toUpperCase()}
              </Badge>
              <h2>
                {skill === "reading"
                  ? "The community garden"
                  : "Riverside Learning Centre"}
              </h2>
              <p>
                {skill === "reading"
                  ? "Discover how a small urban garden brings a neighbourhood together."
                  : "From a learning centre to a community project. Follow four short listening sections."}
              </p>
              <div className="metadata">
                <span>{questions.length} questions</span>
                <span>
                  {skill === "reading" ? "3 paragraphs" : "4 sections"}
                </span>
                <span>Autosaved</span>
              </div>
              <label className="field">
                Practice time
                <select
                  className="input"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </label>
              <button
                className="button primary"
                onClick={() => setStarted(true)}
              >
                {Object.keys(answers).length
                  ? "Resume practice"
                  : "Begin practice"}
                <ArrowRight size={17} />
              </button>
            </div>
          </Card>
          <Card>
            <h3>A space to build confidence</h3>
            <ul className="check-list">
              <li>
                <Check size={16} />
                Answers saved in this browser
              </li>
              <li>
                <Check size={16} />
                Original educational content
              </li>
              <li>
                <Check size={16} />
                Detailed answer explanations
              </li>
              <li>
                <Check size={16} />
                Deterministic answer checking
              </li>
            </ul>
            <p className="notice">
              This is a short frontend sample, not a full-length official IELTS
              test. Academic and General Training use the same original demo
              passage.
            </p>
          </Card>
        </div>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {mode.toUpperCase()} · {skill.toUpperCase()}
          </div>
          <h1>
            {skill === "reading"
              ? "The community garden"
              : "Riverside Learning Centre"}
          </h1>
          <p>
            <CheckCircle2 size={13} /> Your answers are saved automatically in
            this browser.
          </p>
        </div>
        <TestTimer
          id={key}
          minutes={exam ? (skill === "reading" ? 60 : 30) : limit}
          onExpire={() => setTimedOut(true)}
        />
      </div>
      {timedOut && (
        <div className="notice" role="status">
          Time is up. Your answers are preserved. Submit to see your results;
          answers are now locked.
        </div>
      )}
      <div className="practice-toolbar">
        <div className="section-pills">
          {Array.from(
            { length: skill === "listening" ? 4 : 3 },
            (_, i) => i + 1,
          ).map((n) => (
            <button
              key={n}
              className={section === n ? "active" : ""}
              onClick={() => setSection(n)}
            >
              Section {n}
            </button>
          ))}
        </div>
        <div className="saved-state">
          <span className="live-dot" />
          {count}/{questions.length} answered
        </div>
      </div>
      <Progress
        value={(count / questions.length) * 100}
        label="Questions answered"
      />
      <div className="test-workspace">
        <Card className="passage-card">
          {skill === "reading" ? (
            <>
              <div className="section-heading">
                <Badge color="purple">ORIGINAL PASSAGE</Badge>
                <button
                  className={`button small ${highlight ? "primary" : "outline"}`}
                  onClick={() => setHighlight((v) => !v)}
                >
                  <Highlighter size={14} />
                  {highlight ? "Remove highlights" : "Highlight selection"}
                </button>
              </div>
              <div
                className="reading-passage"
                onMouseUp={() => {
                  if (highlight) {
                    const selection = window.getSelection();
                    if (selection?.toString()) {
                      const selected = selection.toString().trim();
                      if (selected)
                        store.draft(
                          `${key}-highlights`,
                          JSON.stringify([
                            ...JSON.parse(
                              store.drafts[`${key}-highlights`] || "[]",
                            ),
                            selected,
                          ]),
                        );
                      selection.removeAllRanges();
                    }
                  }
                }}
              >
                {passage.map((p, i) => (
                  <div key={p.heading}>
                    <span className="paragraph-number">{i + 1}</span>
                    <h3>{p.heading}</h3>
                    <p>
                      {renderHighlights(
                        p.text,
                        highlight
                          ? JSON.parse(
                              store.drafts[`${key}-highlights`] || "[]",
                            )
                          : [],
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <p className="caption">
                Enable highlighting, then select text with a pointer. Use notes
                on touch devices.
              </p>
            </>
          ) : (
            <>
              <AudioPlayer />
              <details className="transcript">
                <summary>Read the original transcript</summary>
                <p>{listeningScript}</p>
              </details>
              {section === 2 && (
                <div
                  className="map-diagram"
                  aria-label="Map: Library north of Reception, Café east of Reception"
                >
                  <div>↑ NORTH</div>
                  <div className="map-place">Library</div>
                  <div className="map-place">
                    Reception <ArrowRight size={15} /> Café
                  </div>
                </div>
              )}
            </>
          )}
          <label className="field notes-field">
            <span>
              <StickyNote size={15} />
              Your notes
            </span>
            <textarea
              className="input"
              value={store.drafts[`${key}-notes`] ?? ""}
              placeholder="A useful detail, a thought to return to…"
              onChange={(e) => store.draft(`${key}-notes`, e.target.value)}
            />
          </label>
        </Card>
        <div className="questions-panel">
          <div className="section-heading">
            <h3>Section {section}</h3>
            <Badge color="slate">
              {questions.filter((q) => q.section === section).length} QUESTIONS
            </Badge>
          </div>
          {questions
            .filter((q) => q.section === section)
            .map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={questions.indexOf(q)}
                value={answers[q.id] ?? ""}
                onChange={(v) => store.answer(key, q.id, v)}
                review={timedOut}
              />
            ))}
          <div className="question-navigation">
            {questions.map((q, i) => (
              <button
                key={q.id}
                aria-label={`Question ${i + 1}`}
                className={answers[q.id] ? "answered" : ""}
                onClick={() => {
                  setSection(q.section);
                  setTimeout(
                    () =>
                      document
                        .getElementById(`question-${q.id}`)
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        }),
                    50,
                  );
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="test-bottom">
            <button
              className="button outline"
              onClick={() =>
                setSection((s) =>
                  s === (skill === "listening" ? 4 : 3) ? 1 : s + 1,
                )
              }
            >
              Next section <ArrowRight size={15} />
            </button>
            <button className="button primary" onClick={() => setConfirm(true)}>
              Submit answers <Check size={15} />
            </button>
          </div>
        </div>
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Ready to reflect?"
        description={`You have answered ${count} of ${questions.length} questions. Unanswered questions are marked incorrect.`}
      >
        <p>
          Your results and answers will be saved to your local practice history.
        </p>
        <div className="dialog-actions">
          <button className="button outline" onClick={() => setConfirm(false)}>
            Keep practicing
          </button>
          <button className="button primary" onClick={submit}>
            Confirm submission
          </button>
        </div>
      </Modal>
    </>
  );
}
function renderHighlights(text: string, highlights: string[]) {
  const unique = [...new Set(highlights)].filter(Boolean);
  if (!unique.length) return text;
  const escaped = unique.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return parts.map((part, i) =>
    unique.some((s) => s.toLowerCase() === part.toLowerCase()) ? (
      <mark key={i}>{part}</mark>
    ) : (
      part
    ),
  );
}
