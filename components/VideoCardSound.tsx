"use client";

import { useEffect, useRef, useState } from "react";
import { useSound } from "@/components/SoundProvider";

type Props = {
  src: string;
  poster?: string;

  // feed control
  active?: boolean;
  preload?: "none" | "metadata" | "auto";

  // Overlay UI
  title?: string;
  description?: string | null;
  spotifyUrl?: string | null;
  soundcloudUrl?: string | null;
  instagramUrl?: string | null;

  likeCount?: number;
  liked?: boolean;
  onLike?: () => void;

  // IMPORTANT: gesture layer gets swipes, this only handles taps
  onTap?: () => void;

  // optional callback for first video loading spinner
  onLoaded?: () => void;
};

function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 21s-7.5-4.5-10-9c-2-4 1-8 5-8 2.2 0 3.8 1.4 5 3 1.2-1.6 2.8-3 5-3 4 0 7 4 5 8-2.5 4.5-10 9-10 9z" />
    </svg>
  );
}

function IconSound({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      {muted ? (
        <>
          <path d="M16 9l5 6" />
          <path d="M21 9l-5 6" />
        </>
      ) : (
        <>
          <path d="M16 8a4 4 0 0 1 0 8" />
          <path d="M18.5 5.5a7 7 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

function IconLink() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10 13a5 5 0 0 1 0-7l1.2-1.2a5 5 0 0 1 7 7L17 13" />
      <path d="M14 11a5 5 0 0 1 0 7l-1.2 1.2a5 5 0 0 1-7-7L7 11" />
    </svg>
  );
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white hover:bg-black/70"
      // keep click working even with the gesture layer
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <IconLink />
      <span className="max-w-[14rem] truncate">{label}</span>
    </a>
  );
}

export function VideoCardSound({
  src,
  poster,
  active = true,
  preload = "metadata",
  title,
  description,
  spotifyUrl,
  soundcloudUrl,
  instagramUrl,
  likeCount = 0,
  liked = false,
  onLike,
  onTap,
  onLoaded,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);

  const { soundOn, audioUnlocked, setSoundOn, unlockAudio } = useSound();
  const shouldUnmute = soundOn && audioUnlocked;

  // Change mute without restarting playback
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !shouldUnmute;
  }, [shouldUnmute]);

  // Load/play on active change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.playsInline = true;
    v.loop = true;
    v.preload = preload;
    v.muted = !shouldUnmute;

    if (!active) {
      v.pause();
      setPaused(false);
      // prefetch for neighbors
      if (preload === "auto") {
        try {
          v.load();
        } catch {}
      }
      return;
    }

    // for active clip
    try {
      v.load();
    } catch {}
    v.play().catch(() => {});
    setPaused(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, active, preload]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  const toggleSound = () => {
    if (!audioUnlocked) {
      unlockAudio();
      setSoundOn(true);
      return;
    }
    setSoundOn(!soundOn);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="h-full w-full object-contain pointer-events-none"
        onLoadedData={() => onLoaded?.()}
      />

      {/* Tap layer for play/pause (keeps video pointer-events off) */}
      <div
        className="absolute inset-0"
        onClick={(e) => {
          e.stopPropagation();
          onTap ? onTap() : togglePlay();
        }}
      />

      {/* Title */}
      {title ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
          {title}
        </div>
      ) : null}

      {/* Right-side controls (with safe-area bottom) */}
      <div
        className="pointer-events-auto absolute right-3 flex flex-col items-center gap-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
      >
        <button
          type="button"
          className="flex flex-col items-center text-white"
          aria-label="like"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onLike?.();
          }}
        >
          <span className={liked ? "text-red-500" : "text-white"}>
            <IconHeart filled={liked} />
          </span>
          <span className="mt-1 text-xs text-white/90">{likeCount}</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center text-white"
          aria-label="toggle sound"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleSound();
          }}
        >
          <IconSound muted={!shouldUnmute} />
          <span className="mt-1 text-xs text-white/90">Sound</span>
        </button>
      </div>

      {/* Bottom-left description + links (this was the missing part) */}
      <div
        className="absolute left-3 right-16 pointer-events-none"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="space-y-2">
          {description ? (
            <div className="text-sm text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)]">
              {description}
            </div>
          ) : null}

          <div className="pointer-events-auto flex flex-wrap gap-2">
            {instagramUrl ? <LinkChip href={instagramUrl} label="Instagram" /> : null}
            {spotifyUrl ? <LinkChip href={spotifyUrl} label="Spotify" /> : null}
            {soundcloudUrl ? <LinkChip href={soundcloudUrl} label="SoundCloud" /> : null}
          </div>
        </div>
      </div>

      {paused ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/55 px-4 py-2 text-sm text-white">Pause</div>
        </div>
      ) : null}
    </div>
  );
}

export default VideoCardSound;
