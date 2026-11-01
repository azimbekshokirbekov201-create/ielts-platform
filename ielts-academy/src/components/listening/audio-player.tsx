"use client";
import { useRef, useState } from "react";
import { Play, Pause, Volume2, Headphones } from "lucide-react";
export function AudioPlayer() {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  return (
    <div className="audio-player">
      <audio
        ref={ref}
        src="/audio/riverside.wav"
        preload="metadata"
        onLoadedMetadata={() => setDuration(ref.current?.duration ?? 0)}
        onTimeUpdate={() => setTime(ref.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
      />
      <div className="audio-title">
        <Headphones size={19} />
        <div>
          <strong>Riverside Learning Centre</strong>
          <small>Original demo script · synthetic narration</small>
        </div>
      </div>
      {error ? (
        <p role="alert">
          Audio unavailable. Use the transcript below to complete the sample.
        </p>
      ) : (
        <>
          <div className="audio-controls">
            <button
              className="round-play"
              aria-label={playing ? "Pause audio" : "Play audio"}
              onClick={async () => {
                if (playing) ref.current?.pause();
                else
                  try {
                    await ref.current?.play();
                  } catch {
                    setError(true);
                  }
              }}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <input
              aria-label="Audio playback position"
              type="range"
              min={0}
              max={duration || 1}
              step="0.1"
              value={time}
              onChange={(e) => {
                if (ref.current)
                  ref.current.currentTime = Number(e.target.value);
              }}
            />
            <span>
              {Math.floor(time / 60)}:
              {Math.floor(time % 60)
                .toString()
                .padStart(2, "0")}
            </span>
          </div>
          <label className="volume-control">
            <Volume2 size={16} />
            <span>Volume</span>
            <input
              aria-label="Audio volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              defaultValue="1"
              onChange={(e) => {
                if (ref.current) ref.current.volume = Number(e.target.value);
              }}
            />
          </label>
        </>
      )}
    </div>
  );
}
