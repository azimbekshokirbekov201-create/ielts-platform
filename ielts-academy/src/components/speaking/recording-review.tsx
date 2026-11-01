"use client";
import { useEffect, useState } from "react";
import { Mic, Check } from "lucide-react";
import { getRecordings, type Recording } from "@/lib/recordings";
import { useAcademy } from "@/store/use-academy";
import {
  Card,
  EmptyState,
  Badge,
  ErrorState,
} from "@/components/ui/primitives";
export function RecordingReview() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selected, setSelected] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const store = useAcademy();
  useEffect(() => {
    getRecordings()
      .then(setRecordings)
      .catch(() => setError("Browser recording storage is unavailable."));
  }, []);
  useEffect(() => {
    const record = recordings.find((r) => r.id === selected);
    if (!record) {
      setAudioUrl("");
      return;
    }
    const url = URL.createObjectURL(record.blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordings, selected]);
  return (
    <Card className="recording-review">
      <div className="section-heading">
        <h3>
          <Mic size={17} /> Speaking recording review
        </h3>
        <Badge color="green">LOCAL AUDIO</Badge>
      </div>
      {error && <ErrorState>{error}</ErrorState>}
      {!recordings.length ? (
        <EmptyState
          title="No local recordings yet"
          description="Record a response in the Speaking workspace, then return here to listen and leave teacher feedback."
        />
      ) : (
        <>
          <label className="field">
            Choose a recorded response
            <select
              className="input"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setSaved(false);
              }}
            >
              <option value="">Select a local recording</option>
              {recordings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.part} · {new Date(r.date).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          {audioUrl && (
            <>
              <audio
                controls
                src={audioUrl}
                aria-label="Student recording for teacher review"
              />
              <label className="field">
                Speaking feedback
                <textarea
                  className="input"
                  rows={4}
                  value={store.drafts[`recording-review-${selected}`] ?? ""}
                  onChange={(e) => {
                    store.draft(`recording-review-${selected}`, e.target.value);
                    setSaved(false);
                  }}
                  placeholder="Comment on fluency, vocabulary, grammar, or pronunciation."
                />
              </label>
              <button
                className="button primary"
                disabled={!store.drafts[`recording-review-${selected}`]?.trim()}
                onClick={() => setSaved(true)}
              >
                <Check size={15} />
                {saved ? "Feedback saved locally" : "Save speaking feedback"}
              </button>
              {saved && (
                <p role="status">Your feedback is saved in this browser.</p>
              )}
            </>
          )}
        </>
      )}
      <p className="caption">
        Only recordings created in this browser are available. No student audio
        is uploaded.
      </p>
    </Card>
  );
}
