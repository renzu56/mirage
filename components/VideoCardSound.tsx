"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSound } from "@/components/SoundProvider";

type Props = {
  src: string;
  poster?: string;

  active?: boolean;
  preload?: "none" | "metadata" | "auto";

  title?: string;
  description?: string | null;
  spotifyUrl?: string | null;
  soundcloudUrl?: string | null;
  instagramUrl?: string | null;

  likeCount?: number;
  liked?: boolean;
  onLike?: () => void;

  onTap?: () => void;
  onLoaded?: () => void;
};

function nonEmpty(s: string | null | undefined) {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Ensure links always open as absolute URLs (never "mirage.dzrenzu.com/<url>").
 * Also blocks unsafe schemes.
 */
function normalizeUrl(raw: string) {
  let u = raw.trim();
  if (!u) return "";

  // block unsafe schemes
  if (/^(javascript|data):/i.test(u)) return "";

  // protocol-relative URLs like //open.spotify.com/...
  if (/^\/\//.test(u)) return `https:${u}`;

  // accidental relative paths like /open.spotify.com/...
  u = u.replace(/^\/+/, "");

  // already absolute
  if (/^https?:\/\//i.test(u)) return u;

  // add scheme
  return `https://${u}`;
}

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
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <IconLink />
      <span className="max-w-[14rem] truncate">{label}</span>
    </a>
  );
}

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {!expanded ? (
        <div className="rounded-xl bg-black/45 px-3 py-2 backdrop-blur-[2px]">
          <div className="text-sm text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)] line-clamp-3">
            {text}
          </div>
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-white/80 hover:text-white"
            onClick={() => setExpanded(true)}
          >
            See more
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-black/60 px-3 py-2 backdrop-blur-[2px]">
          <div
            className="max-h-44 overflow-y-auto pr-1 text-sm text-white"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {text}
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-white/80 hover:text-white"
            onClick={() => setExpanded(false)}
          >
            See less
          </button>
        </div>
      )}
    </div>
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
  const [playbackError, setPlaybackError] = useState(false);

  const { soundOn, audioUnlocked, setSoundOn, unlockAudio } = useSound();
  const shouldUnmute = soundOn && audioUnlocked;

  const descText = useMemo(() => (description ?? "").trim(), [description]);

  const spotifyHref = useMemo(
    () => (nonEmpty(spotifyUrl) ? normalizeUrl(spotifyUrl as string) : ""),
    [spotifyUrl]
  );
  const soundcloudHref = useMemo(
    () => (nonEmpty(soundcloudUrl) ? normalizeUrl(soundcloudUrl as string) : ""),
    [soundcloudUrl]
  );
  const instagramHref = useMemo(
    () => (nonEmpty(instagramUrl) ? normalizeUrl(instagramUrl as string) : ""),
    [instagramUrl]
  );

  const hasLinks = Boolean(spotifyHref || soundcloudHref || instagramHref);

  // Mute/unmute without restarting the video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !shouldUnmute;
  }, [shouldUnmute]);

  // Load/play only when src/active/preload changes (not when sound changes)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    setPlaybackError(false);

    v.playsInline = true;
    v.loop = true;
    v.preload = preload;
    v.muted = !shouldUnmute;

    // iOS / Safari reliability attributes
    // @ts-ignore
    v.webkitPlaysInline = true;
    // @ts-ignore
    v.disablePictureInPicture = true;

    if (!active) {
      v.pause();
      setPaused(false);
      if (preload === "auto") {
        try {
          v.load();
        } catch {}
      }
      return;
    }

    try {
      v.load();
    } catch {}

    v.play()
      .then(() => {
        setPaused(false);
      })
      .catch(() => {
        // autoplay or decode can fail; keep UI responsive
      });

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
      {/* iOS-safe video wrapper */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="max-h-full max-w-full object-contain pointer-events-none"
          playsInline
          // @ts-ignore
          webkitPlaysInline="true"
          disablePictureInPicture
          controls={false}
          onLoadedData={() => onLoaded?.()}
          onError={() => {
            setPlaybackError(true);
          }}
        />
      </div>

      {/* Tap layer BELOW overlays */}
      <div
        className="absolute inset-0 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onTap ? onTap() : togglePlay();
        }}
      />

      {/* Title */}
      {title ? (
        <div className="pointer-events-none absolute left-3 top-3 z-40 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
          {title}
        </div>
      ) : null}

      {/* Right controls */}
      <div className="pointer-events-auto absolute right-3 bottom-20 z-40 flex flex-col items-center gap-4">
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

      {/* Bottom-left description + links */}
      {(descText.length > 0 || hasLinks) ? (
        <div className="absolute left-3 right-16 bottom-3 z-40">
          <div className="space-y-2">
            {descText.length > 0 ? <ExpandableDescription text={descText} /> : null}

            {hasLinks ? (
              <div
                className="pointer-events-auto flex flex-wrap gap-2"
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {instagramHref ? <LinkChip href={instagramHref} label="Instagram" /> : null}
                {spotifyHref ? <LinkChip href={spotifyHref} label="Spotify" /> : null}
                {soundcloudHref ? <LinkChip href={soundcloudHref} label="SoundCloud" /> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Playback error overlay (common when iOS can't decode a file) */}
      {playbackError ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <div className="rounded-2xl bg-black/70 px-4 py-3 text-sm text-white">
            This video can’t be played on this device (codec/format). Please re-upload as H.264 + AAC.
          </div>
        </div>
      ) : null}

      {/* Pause overlay */}
      {paused ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className="rounded-full bg-black/55 px-4 py-2 text-sm text-white">Pause</div>
        </div>
      ) : null}
    </div>
  );
}

export default VideoCardSound;
