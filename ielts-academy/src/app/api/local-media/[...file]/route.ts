import { cookies } from "next/headers";
import { userDb, sessionUser } from "@/server/local/client";
import {
  deliveryHeaders,
  matchesFileType,
  maxUploadBytes,
} from "@/server/uploads";
export const runtime = "nodejs";
async function handler(
  req: Request,
  { params }: { params: Promise<{ file: string[] }> },
) {
  const user = await sessionUser(
    (await cookies()).get("academy_session")?.value,
  );
  if (!user) return new Response(null, { status: 401 });
  const [bucket, ...parts] = (await params).file,
    path = parts.join("/");
  const db = await userDb();
  try {
    if (req.method === "GET") {
      const r = await db.storage.from(bucket).download(path);
      if (r.error || !r.data) return new Response(null, { status: 403 });
      return new Response(r.data, {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          ...(bucket === "speaking"
            ? { "Content-Type": r.data.type }
            : deliveryHeaders(path)),
        },
      });
    }
    if (
      req.headers.get("origin") !==
      new URL(process.env.APP_URL || req.url).origin
    )
      return new Response(null, { status: 403 });
    const reader = req.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxUploadBytes(bucket)) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const type =
      (req.headers.get("content-type") || "").split(";")[0] ||
      "application/octet-stream";
    // Student recordings are verified byte by byte; author uploads can be any file.
    if (
      bucket === "speaking" &&
      (!matchesFileType(type, bytes) || !type.startsWith("audio/"))
    )
      return new Response(null, { status: 400 });
    const r = await db.storage
      .from(bucket)
      .upload(path, new Blob([bytes]), { contentType: type });
    return Response.json(
      r.error ? { error: "invalid_file" } : { data: { path } },
      { status: r.error ? 403 : 200 },
    );
  } catch {
    return new Response(null, { status: 400 });
  }
}
export { handler as GET, handler as PUT };
