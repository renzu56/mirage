"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { VideoFrame } from "@/components/VideoFrame";
import { VideoCardSound } from "@/components/VideoCardSound";

export type FeedVideo = {
  id: string;
  src: string;
  poster?: string;
  title?: string;
  description?: string | null;
  spotifyUrl?: string | null;
  soundcloudUrl?: string | null;
  instagramUrl?: string | null;
  likeCount?: number;
};

type Props = {
  eventId: string;
  videos: FeedVideo[];
};

// Track like counts and whether a video is liked for each video.
type LikeState = Record<string, { count: number; liked: boolean }>;

function initLikeState(videos: FeedVideo[]): LikeState {
  const s: LikeState = {};
  for (const v of videos) s[v.id] = { count: Number(v.likeCount ?? 0), liked: false };
  return s;
}

/**
 * A simplified TikTok‑style feed component that uses native scroll and CSS scroll snapping
 * instead of manual translation logic. Each video occupies the full viewport height and
 * snaps cleanly into place as the user scrolls. The current video is detected via
 * IntersectionObserver, and the like API is called when the user taps the heart icon.
 */
export function VideoFeedClient({ eventId, videos }: Props) {
  // Manage like counts per video (optimistic UI updates).
  const [likes, setLikes] = useState<LikeState>(() => initLikeState(videos));
  useEffect(() => {
    // When the list of videos changes, ensure like state exists for each new video and clamp
    // the current index to the new length.
    setLikes((prev) => {
      const next: LikeState = { ...prev };
      for (const v of videos) {
        if (!next[v.id]) next[v.id] = { count: Number(v.likeCount ?? 0), liked: false };
      }
      return next;
    });
  }, [videos]);

  // Index of the currently active (visible) slide.
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track whether the very first video has finished loading. Until this is
  // true, we show a full‑screen spinner overlay. Without this flag the
  // first clip may appear to hang on slower connections.
  const [firstVideoLoaded, setFirstVideoLoaded] = useState(false);

  // Preload the first video aggressively. Create a temporary video element
  // and call load() to start fetching the file. Browsers may still choose
  // to defer downloading depending on network conditions, but this hint
  // often helps wake up the first clip sooner.
  useEffect(() => {
    if (videos.length === 0) return;
    const vid = document.createElement("video");
    vid.src = videos[0].src;
    vid.preload = "auto";
    try {
      vid.load();
    } catch {}
    // We don't append the element to the DOM; it stays in memory. No cleanup
    // necessary because it's eligible for garbage collection when unreferenced.
  }, [videos]);

  // Handler invoked when the first video element reports that it has loaded
  // enough data to begin playback. We only need to set this flag once.
  const handleFirstVideoLoaded = useCallback(() => {
    setFirstVideoLoaded(true);
  }, []);

  // Ensure the first video is considered active on mount. Without this,
  // IntersectionObserver may not immediately fire its callback, leaving the first
  // slide inactive until the observer runs. This guarantees the first video
  // will attempt to play as soon as the component mounts.
  useEffect(() => {
    setCurrentIndex(0);
  }, []);


  // Ref to the scrollable container.
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Observe which slide is most visible and update currentIndex accordingly.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // We observe when a slide's intersection ratio exceeds 0.6 (60 % of its height is visible).
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const i = Number((entry.target as HTMLElement).dataset.index);
            if (!isNaN(i)) setCurrentIndex(i);
          }
        });
      },
      {
        root: container,
        threshold: 0.6,
      }
    );
    // Start observing each slide.
    const slides = container.querySelectorAll<HTMLDivElement>("[data-index]");
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [videos]);

  // Like handler – toggles the like state of the given video ID and sends a POST to /api/like.
  const handleLike = useCallback(
    async (id: string) => {
      setLikes((prev) => {
        const curr = prev[id] ?? { count: 0, liked: false };
        const liked = !curr.liked;
        const count = Math.max(0, curr.count + (liked ? 1 : -1));
        return { ...prev, [id]: { liked, count } };
      });
      try {
        const res = await fetch("/api/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, submissionId: id }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { like_count?: number };
        if (typeof data.like_count === "number") {
          setLikes((prev) => {
            const curr = prev[id] ?? { count: 0, liked: false };
            return { ...prev, [id]: { ...curr, count: data.like_count! } };
          });
        }
      } catch {
        // If the request fails, we leave the optimistic update in place.
      }
    },
    [eventId]
  );

  if (videos.length === 0) {
    return (
      <div className="w-full flex items-center justify-center text-sm opacity-70">
        No videos
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] overflow-x-hidden"
      // Hide the scrollbars while preserving scroll behavior on desktop.
      // Prevent overscroll bounce on mobile.
      style={{ overscrollBehavior: "contain" }}
    >
      {/* Slides */}
      {videos.map((video, i) => {
        const likeState = likes[video.id] ?? { count: Number(video.likeCount ?? 0), liked: false };
        // Preload only the current and immediate neighbor slides aggressively.  For
        // videos more than one slide away we only load metadata to save bandwidth.
        const preloadType = Math.abs(currentIndex - i) <= 1 ? "auto" : "metadata";
        return (
          <div
            key={video.id}
            data-index={i}
            className="h-[100dvh] w-full snap-start flex items-start justify-center pt-8"
          >
            <VideoFrame>
              <VideoCardSound
                active={currentIndex === i}
                preload={preloadType as "auto" | "metadata"}
                src={video.src}
                poster={video.poster}
                title={video.title}
                description={video.description}
                spotifyUrl={video.spotifyUrl}
                soundcloudUrl={video.soundcloudUrl}
                instagramUrl={video.instagramUrl}
                likeCount={likeState.count}
                liked={likeState.liked}
                onLike={() => handleLike(video.id)}
                // Für den allerersten Clip übergeben wir eine onLoaded Callback,
                // damit wir wissen, wann er bereit ist und den Ladespinner
                // ausblenden können.
                onLoaded={i === 0 ? handleFirstVideoLoaded : undefined}
              />
            </VideoFrame>
          </div>
        );
      })}
      {/* Slide indicator */}
      <div className="absolute right-4 top-4 px-2 py-1 rounded-lg bg-black/40 text-white/80 text-xs">
        {currentIndex + 1}/{videos.length}
      </div>

      {/* Ladespinner für das erste Video: Zeigt einen sich drehenden Kreis,
         während der erste Clip im Hintergrund geladen wird. Sobald
         `handleFirstVideoLoaded` ausgelöst wurde, wird dieses Overlay
         ausgeblendet. */}
      {!firstVideoLoaded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="h-12 w-12 border-4 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}

export default VideoFeedClient;