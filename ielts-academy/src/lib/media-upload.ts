import { api, RequestError } from "./api";
export async function uploadMedia(
  file: Blob,
  bucket: "speaking" | "course-media",
) {
  const type = file.type.split(";")[0];
  const issued = await api<{ signedUrl: string; path: string }>(
    "media-upload",
    "POST",
    { bucket, type, size: file.size },
  );
  const response = await fetch(issued.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": type, "x-upsert": "false" },
    body: file,
  });
  if (!response.ok) throw new RequestError("invalid_file", response.status);
  return api<{ path: string }>("media-finalize", "POST", {
    bucket,
    path: issued.path,
  });
}
