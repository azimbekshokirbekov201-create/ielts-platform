"use client";
import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Download,
  Play,
  ShieldCheck,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import {
  Card,
  Badge,
  Tabs,
  ErrorState,
  EmptyState,
} from "@/components/ui/primitives";
import { TestTimer } from "@/components/test-timer";
import { Feedback } from "@/features/writing";
import { getRecordings, saveRecording, type Recording } from "@/lib/recordings";
import { useAcademy } from "@/store/use-academy";
import type { Attempt } from "@/types";
export function Speaking({
  exam = false,
  onComplete,
}: {
  exam?: boolean;
  onComplete?: (a: Attempt) => void;
}) {
  const [part, setPart] = useState("Part 1");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [history, setHistory] = useState<Recording[]>([]);
  const [feedback, setFeedback] = useState(false);
  const [prep, setPrep] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const addAttempt = useAcademy((s) => s.addAttempt);
  useEffect(() => {
    getRecordings()
      .then(setHistory)
      .catch(() =>
        setError(
          "Recording storage is unavailable. You can still practice without recording.",
        ),
      );
    return () => {
      const r = recorder.current;
      if (r?.state === "recording") {
        r.onstop = null;
        r.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(seconds);
      if (seconds >= 300 && recorder.current?.state === "recording")
        recorder.current.stop();
    }, 500);
    return () => clearInterval(timer);
  }, [recording]);
  async function begin() {
    if (busy || recording) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Recording requires a supported browser and HTTPS or localhost. You can still practice the prompts aloud.",
      );
      return;
    }
    setBusy(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = async () => {
        setRecording(false);
        media.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) {
          setError("No audio was captured. Try recording again.");
          return;
        }
        setUrl(URL.createObjectURL(blob));
        const item: Recording = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          part,
          blob,
        };
        try {
          await saveRecording(item);
          setHistory(await getRecordings());
        } catch {
          setError(
            "The recording can be replayed and downloaded, but browser storage failed. Download it to keep a copy.",
          );
        }
      };
      rec.onerror = () => {
        setError("The microphone recording was interrupted.");
        setRecording(false);
        media.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
      setSubmitted(false);
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Enable access in browser settings and try again."
          : "A microphone could not be opened. Check your device and permissions.",
      );
    } finally {
      setBusy(false);
    }
  }
  function submit() {
    const a: Attempt = {
      id: crypto.randomUUID(),
      skill: "speaking",
      title: `Speaking · ${part}`,
      date: new Date().toISOString(),
      status: "Awaiting evaluation",
    };
    addAttempt(a);
    setSubmitted(true);
    onComplete?.(a);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FIND YOUR VOICE</div>
          <h1>Confidence starts with a conversation.</h1>
          <p>A quiet space to speak, listen back, and grow.</p>
        </div>
        <Badge color="green">
          {exam ? "EXAM · LOCAL RECORDING" : "LOCAL RECORDING"}
        </Badge>
      </div>
      <div className="practice-toolbar">
        <Tabs
          items={["Part 1", "Part 2", "Part 3"]}
          value={part}
          onChange={(v) => {
            if (!recording && !busy) {
              setPart(v);
              setPrep(false);
              setSubmitted(false);
            }
          }}
        />
        <span className="caption">AI examiner · upcoming</span>
      </div>
      <div className="speaking-layout">
        <Card className="cue-card">
          <span className="skill-icon green large">
            <MessageCircle size={28} />
          </span>
          <Badge color="green">
            {part.toUpperCase()} ·{" "}
            {part === "Part 1"
              ? "INTRODUCTION"
              : part === "Part 2"
                ? "LONG TURN"
                : "DISCUSSION"}
          </Badge>
          <h2>
            {part === "Part 1"
              ? "The places we call home"
              : part === "Part 2"
                ? "A journey worth remembering"
                : "Why we travel"}
          </h2>
          {part === "Part 1" ? (
            <ol>
              <li>Where do you live, and what do you like about it?</li>
              <li>What is your favourite place in your neighbourhood?</li>
              <li>Would you like to live somewhere different in the future?</li>
            </ol>
          ) : part === "Part 2" ? (
            <>
              <p>
                Describe a memorable journey you have taken. You should say:
              </p>
              <ul>
                <li>where you went</li>
                <li>who you travelled with</li>
                <li>what happened during the journey</li>
              </ul>
              <p>and explain why this journey was memorable.</p>
              <button
                className="button outline"
                onClick={() => setPrep(true)}
                disabled={prep}
              >
                Start 1-minute preparation
              </button>
              {prep && <TestTimer id={`speaking-prep-${part}`} minutes={1} />}
            </>
          ) : (
            <ol>
              <li>How has travel changed in recent decades?</li>
              <li>What can people learn from visiting other countries?</li>
              <li>Should cities limit the number of tourists they receive?</li>
            </ol>
          )}
          <div className="notice">
            There’s no perfect answer. Focus on expressing your ideas clearly
            and naturally.
          </div>
        </Card>
        <Card className="recording-card">
          <div className={`microphone-orb ${recording ? "recording" : ""}`}>
            <Mic size={36} />
          </div>
          <h2>
            {recording
              ? "Your voice. Your moment."
              : "Take a breath. You’ve got this."}
          </h2>
          <p>
            {recording
              ? "Recording on your device · maximum 5 minutes"
              : "Your microphone is only accessed when you press record."}
          </p>
          <div className="recording-time">
            {Math.floor(elapsed / 60)
              .toString()
              .padStart(2, "0")}
            :{(elapsed % 60).toString().padStart(2, "0")}
          </div>
          <div
            className={`waveform ${recording ? "moving" : ""}`}
            aria-hidden="true"
          >
            {Array.from({ length: 27 }, (_, i) => (
              <i
                key={i}
                style={{
                  height: `${10 + ((i * 13) % 39)}px`,
                  animationDelay: `${i * 0.06}s`,
                }}
              />
            ))}
          </div>
          {recording ? (
            <button
              className="button destructive"
              onClick={() => recorder.current?.stop()}
            >
              <Square size={16} />
              Stop recording
            </button>
          ) : (
            <button className="button primary" onClick={begin} disabled={busy}>
              <Mic size={17} />
              {busy
                ? "Opening microphone…"
                : url
                  ? "Record again"
                  : "Start recording"}
            </button>
          )}
          {error && <ErrorState>{error}</ErrorState>}
          {url && (
            <div className="recording-playback">
              <audio controls src={url} aria-label="Replay your recording" />
              <a
                href={url}
                download={`ielts-${part.toLowerCase().replace(" ", "-")}.${recorder.current?.mimeType.includes("mp4") ? "mp4" : "webm"}`}
                className="button outline small"
              >
                <Download size={15} />
                Download recording
              </a>
              <button
                className="button primary small"
                disabled={submitted || recording}
                onClick={submit}
              >
                {submitted
                  ? "Saved · Awaiting evaluation"
                  : "Save practice session"}
                <ArrowRight size={15} />
              </button>
            </div>
          )}
          <p className="privacy-note">
            <ShieldCheck size={14} />
            Audio stays in this browser. No uploads, no AI analysis.
          </p>
        </Card>
      </div>
      <Card>
        <div className="section-heading">
          <h3>Your voice, over time</h3>
          <Badge color="slate">{history.length} RECORDINGS</Badge>
        </div>
        {history.length ? (
          history.map((r) => (
            <div className="history-row" key={r.id}>
              <Play size={17} />
              <span>
                {r.part}
                <small>{new Date(r.date).toLocaleString()}</small>
              </span>
              <button
                className="button outline small"
                onClick={() => {
                  if (!recording) setUrl(URL.createObjectURL(r.blob));
                }}
                disabled={recording}
              >
                Replay
              </button>
              <button
                className="button outline small"
                onClick={() => {
                  const link = document.createElement("a");
                  const recordingUrl = URL.createObjectURL(r.blob);
                  link.href = recordingUrl;
                  link.download = `ielts-${r.id}.${r.blob.type.includes("mp4") ? "mp4" : "webm"}`;
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(recordingUrl), 1000);
                }}
              >
                <Download size={14} />
                Download
              </button>
            </div>
          ))
        ) : (
          <EmptyState
            title="Your first recording is a beginning"
            description="Recorded sessions will be stored in this browser using IndexedDB."
          />
        )}
      </Card>
      <Card className="ai-preview">
        <div>
          <Badge color="purple">EXAMPLE FEEDBACK</Badge>
          <h3>Curious about the feedback experience?</h3>
          <p>Preview a fixed example. It does not assess your recording.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => setFeedback((v) => !v)}
        >
          {feedback ? "Hide demo feedback" : "Show demo feedback"}
        </button>
      </Card>
      {feedback && <Feedback kind="speaking" />}
    </>
  );
}
