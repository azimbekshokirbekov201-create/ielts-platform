"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { uploadMedia } from "@/lib/media-upload";
import { useApp } from "./academy-context";
import { PrivateMedia } from "./academy";
export function FileUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { run, t } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [name, setName] = useState("");
  function upload(file: File | undefined) {
    if (!file) return;
    setName(file.name + " · " + (file.size / 1048576).toFixed(2) + " MB");
    setProgress(0);
    void run(async () => {
      const r = await uploadMedia(file, "course-media", setProgress);
      onChange(r.path);
    }).finally(() => setProgress(null));
  }
  return (
    <div
      className="upload-dropzone"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        upload(e.dataTransfer.files[0]);
      }}
    >
      <p>{t("drop_files")}</p>
      <input
        ref={input}
        type="file"
        aria-label="Choose attachment"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.mp4"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <button
        type="button"
        className="button outline"
        disabled={progress !== null}
        onClick={() => input.current?.click()}
      >
        {t("browse_files")}
      </button>
      <p>{name}</p>
      {progress !== null && (
        <progress aria-label="Upload progress" value={progress} max={100} />
      )}
      {value && (
        <>
          <PrivateMedia path={value} label="Preview attachment" />
          <button
            type="button"
            className="button outline"
            onClick={() => {
              const path = value;
              onChange("");
              setName("");
              if (!path.includes("://"))
                void run(() => api("media-remove", "POST", { path }));
            }}
          >
            Remove attachment
          </button>
        </>
      )}
    </div>
  );
}
