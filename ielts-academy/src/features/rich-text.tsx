"use client";
import { useRef } from "react";
export function RichTextView({ text }: { text: string }) {
  return (
    <div className="preserve-text">
      {text.split("\n").map((line, i) => (
        <p key={i}>
          {line
            .split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
            .map((part, j) =>
              part.startsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : part.startsWith("_") ? (
                <em key={j}>{part.slice(1, -1)}</em>
              ) : (
                part
              ),
            )}
        </p>
      ))}
    </div>
  );
}
export function RichEditor({
  value,
  onChange,
  label = "Rich text",
}: {
  value: string;
  label?: string;
  onChange: (s: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function format(marker: string) {
    const area = ref.current;
    if (!area) return;
    const a = area.selectionStart,
      b = area.selectionEnd;
    onChange(
      value.slice(0, a) + marker + value.slice(a, b) + marker + value.slice(b),
    );
    area.focus();
  }
  return (
    <div>
      <div className="editor-toolbar">
        <button
          className="button outline small"
          type="button"
          onClick={() => format("**")}
        >
          Bold
        </button>
        <button
          className="button outline small"
          type="button"
          onClick={() => format("_")}
        >
          Italic
        </button>
      </div>
      <textarea
        aria-label={label}
        ref={ref}
        className="input live-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={50000}
      />
    </div>
  );
}
