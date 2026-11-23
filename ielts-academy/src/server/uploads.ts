export function matchesFileType(type: string, data: Uint8Array): boolean {
  const text = (start: number, end: number) =>
    new TextDecoder().decode(data.slice(start, end));
  switch (type) {
    case "image/jpeg":
      return data[0] === 255 && data[1] === 216 && data[2] === 255;
    case "image/png":
      return data.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    case "image/webp":
      return text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
    case "application/pdf":
      return text(0, 5) === "%PDF-";
    case "audio/webm":
      return data.slice(0, 4).join(",") === "26,69,223,163";
    case "audio/ogg":
      return text(0, 4) === "OggS";
    case "audio/wav":
      return text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
    case "audio/mpeg":
      return (
        text(0, 3) === "ID3" || (data[0] === 255 && (data[1] & 224) === 224)
      );
    case "audio/mp4":
    case "video/mp4":
      return text(4, 8) === "ftyp";
    default:
      return false;
  }
}

/** Largest file an author may upload (MB, set MAX_UPLOAD_MB in .env). Student recordings stay at 25 MB. */
export function maxUploadBytes(bucket: string) {
  if (bucket === "speaking") return 26214400;
  const mb = Number(process.env.MAX_UPLOAD_MB);
  return Math.floor(
    (Number.isFinite(mb) && mb > 0 ? Math.min(mb, 2000) : 100) * 1048576,
  );
}
/** Safe file extension taken from the original file name ("bin" when there is none). */
export function extensionOf(name?: string, fallback = "bin") {
  const ext = /\.([A-Za-z0-9]{1,10})$/.exec(name || "")?.[1]?.toLowerCase();
  return ext || fallback;
}
const inline: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  webm: "audio/webm",
  mp4: "video/mp4",
  txt: "text/plain; charset=utf-8",
};
/**
 * How an uploaded file is delivered. The type comes from the extension the server chose,
 * never from what the uploader claimed. Pages run inside a sandbox (no access to the site's
 * cookies or API); everything unknown is a download, so an upload can never act as site code.
 */
export function deliveryHeaders(path: string): Record<string, string> {
  const ext = extensionOf(path.split("/").pop(), "");
  if (ext === "html" || ext === "htm")
    return {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads",
    };
  if (inline[ext]) return { "Content-Type": inline[ext] };
  return {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": "attachment",
  };
}
