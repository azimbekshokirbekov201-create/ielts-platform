"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  ClipboardCheck,
} from "lucide-react";
import { Card, Badge, Tabs, Modal, Progress } from "@/components/ui/primitives";
import { Practice } from "@/features/practice";
import { Writing } from "@/features/writing";
import { Speaking } from "@/features/speaking";
import { useAcademy } from "@/store/use-academy";
import type { Attempt } from "@/types";
export function MockExam() {
  const [mode, setMode] = useState("Academic");
  const [step, setStep] = useState(-1);
  const [confirm, setConfirm] = useState(false);
  const store = useAcademy();
  const key = `mock-${mode}`;
  const saved: Record<string, Attempt> = JSON.parse(store.drafts[key] || "{}");
  const parts = ["Listening", "Reading", "Writing", "Speaking"];
  function complete(a: Attempt) {
    store.draft(key, JSON.stringify({ ...saved, [parts[step]]: a }));
  }
  function finish() {
    store.addAttempt({
      id: crypto.randomUUID(),
      skill: "mock",
      title: `${mode} mock · sample sequence`,
      date: new Date().toISOString(),
      status: "Writing & Speaking awaiting evaluation",
      score: (saved.Listening?.score ?? 0) + (saved.Reading?.score ?? 0),
      total: 14,
    });
    setConfirm(false);
    setStep(4);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE BIG PICTURE</div>
          <h1>
            {step === 4
              ? "One more step in your story."
              : "Practice the whole journey."}
          </h1>
          <p>
            A four-skill sample sequence, designed to bring your practice
            together.
          </p>
        </div>
        <Badge color="purple">SHORT DEMO EXAM</Badge>
      </div>
      {step === -1 ? (
        <>
          <Tabs
            items={["Academic", "General Training"]}
            value={mode}
            onChange={setMode}
          />
          <Card className="mock-intro">
            <span className="skill-icon purple large">
              <ClipboardCheck size={30} />
            </span>
            <h2>{mode} IELTS · guided sample</h2>
            <p>
              Move through Listening, Reading, Writing, and Speaking at your own
              pace. Responses are saved locally as you go.
            </p>
            <div className="mock-parts">
              {[
                {
                  icon: Headphones,
                  name: "Listening",
                  time: "30 min · 7 questions",
                },
                {
                  icon: BookOpen,
                  name: "Reading",
                  time: "60 min · 7 questions",
                },
                {
                  icon: PenLine,
                  name: "Writing",
                  time: "20–40 min · one task",
                },
                { icon: Mic, name: "Speaking", time: "Recorded practice" },
              ].map((p) => (
                <div key={p.name}>
                  <p.icon size={23} />
                  <h4>{p.name}</h4>
                  <p>{p.time}</p>
                </div>
              ))}
            </div>
            <div className="notice">
              This is a shortened frontend demonstration, not a full IELTS
              examination. Academic and General Training currently share the
              same original objective questions. Writing and Speaking await
              evaluation.
            </div>
            <button
              className="button primary"
              onClick={() =>
                setStep(
                  Math.max(
                    0,
                    parts.findIndex((p) => !saved[p]),
                  ),
                )
              }
            >
              {Object.keys(saved).length
                ? "Resume sample exam"
                : "Begin sample exam"}
              <ArrowRight size={17} />
            </button>
          </Card>
        </>
      ) : step === 4 ? (
        <>
          <Card className="result-hero">
            <Check size={36} />
            <div>
              <h2>Sample exam saved</h2>
              <p>
                Objective answers:{" "}
                {(saved.Listening?.score ?? 0) + (saved.Reading?.score ?? 0)} /
                14
              </p>
              <Badge color="orange">
                WRITING & SPEAKING · AWAITING EVALUATION
              </Badge>
            </div>
            <p>
              No overall band is calculated without evaluated Writing and
              Speaking scores.
            </p>
          </Card>
          <div className="skill-grid">
            {parts.map((p) => (
              <Card key={p}>
                <h3>{p}</h3>
                <p>
                  {saved[p]?.score != null
                    ? `${saved[p].score}/${saved[p].total} correct`
                    : "Awaiting evaluation"}
                </p>
              </Card>
            ))}
          </div>
          <button className="button outline" onClick={() => setStep(-1)}>
            Return to exam selection
          </button>
        </>
      ) : (
        <>
          <div className="exam-steps">
            {parts.map((p, i) => (
              <button
                key={p}
                className={step === i ? "active" : ""}
                onClick={() => setStep(i)}
              >
                <span>{saved[p] ? <Check size={14} /> : i + 1}</span>
                {p}
              </button>
            ))}
          </div>
          <Progress
            value={(Object.keys(saved).length / 4) * 100}
            label="Exam sections completed"
          />
          <div className="exam-workspace" key={step}>
            {step === 0 ? (
              <Practice
                skill="listening"
                exam
                examMode={mode}
                onComplete={complete}
              />
            ) : step === 1 ? (
              <Practice
                skill="reading"
                exam
                examMode={mode}
                onComplete={complete}
              />
            ) : step === 2 ? (
              <Writing exam onComplete={complete} />
            ) : (
              <Speaking exam onComplete={complete} />
            )}
          </div>
          <div className="exam-controls">
            <span>
              {saved[parts[step]]
                ? "Section saved. You can move on."
                : "Submit this section to save it before moving on."}
            </span>
            {step < 3 ? (
              <button
                className="button primary"
                disabled={!saved[parts[step]]}
                onClick={() => setStep((s) => s + 1)}
              >
                Next: {parts[step + 1]}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="button primary"
                disabled={Object.keys(saved).length < 4}
                onClick={() => setConfirm(true)}
              >
                Finish sample exam
              </button>
            )}
          </div>
        </>
      )}
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Finish your sample exam?"
        description="Your four completed sections will be added to local practice history."
      >
        <p>
          Objective responses are checked automatically. Writing and Speaking
          remain awaiting evaluation.
        </p>
        <div className="dialog-actions">
          <button className="button outline" onClick={() => setConfirm(false)}>
            Go back
          </button>
          <button className="button primary" onClick={finish}>
            Confirm and finish
          </button>
        </div>
      </Modal>
    </>
  );
}
