"use client";
import { useState } from "react";
import { youtubeId } from "@/lib/youtube";
export function YouTubePlayer({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const id = youtubeId(url);
  if (!id) return <p role="alert">Invalid YouTube link.</p>;
  return (
    <div className="youtube-player">
      {loading && <span role="status">Loading video…</span>}
      <iframe
        key={id}
        src={"https://www.youtube-nocookie.com/embed/" + id}
        title="Video lesson"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
