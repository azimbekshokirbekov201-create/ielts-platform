"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useAcademy } from "@/store/use-academy";
export function TestTimer({
  id,
  minutes = 20,
  onExpire,
  paused = false,
}: {
  id: string;
  minutes?: number;
  onExpire?: () => void;
  paused?: boolean;
}) {
  const drafts = useAcademy((s) => s.drafts);
  const draft = useAcademy((s) => s.draft);
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    if (paused) return;
    let deadline = Number(drafts[`timer-${id}`]);
    if (!deadline) {
      deadline = Date.now() + minutes * 60000;
      draft(`timer-${id}`, String(deadline));
    }
    let expired = false;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !expired) {
        expired = true;
        onExpire?.();
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [id, minutes, draft, drafts, onExpire, paused]);
  return (
    <span
      className={`timer ${left < 60 ? "urgent" : ""}`}
      aria-label="Time remaining"
    >
      <Clock size={16} />
      {Math.floor(left / 60)
        .toString()
        .padStart(2, "0")}
      :{(left % 60).toString().padStart(2, "0")}
    </span>
  );
}
