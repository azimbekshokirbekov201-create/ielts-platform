import { api, RequestError } from "./api";
export async function uploadMedia(
  file: Blob,
  bucket: "speaking" | "course-media",
  progress?: (value: number) => void,
) {
  const raw = file.type.split(";")[0];
  const type =
    (
      { "audio/x-m4a": "audio/mp4", "audio/x-wav": "audio/wav" } as Record<
        string,
        string
      >
    )[raw] || raw;
  const issued = await api<{ signedUrl: string; path: string }>(
    "media-upload",
    "POST",
    { bucket, type, size: file.size },
  );
  if (progress)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", issued.signedUrl);
      xhr.setRequestHeader("Content-Type", type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          progress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new RequestError("invalid_file", xhr.status));
      xhr.onerror = () => reject(new RequestError("invalid_file", 0));
      xhr.send(file);
    });
  else {
    const response = await fetch(issued.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": type },
      body: file,
    });
    if (!response.ok) throw new RequestError("invalid_file", response.status);
  }
  return api<{ path: string }>("media-finalize", "POST", {
    bucket,
    path: issued.path,
    name: file instanceof File ? file.name : undefined,
  });
}
