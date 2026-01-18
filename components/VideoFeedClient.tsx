"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type LikeState = Record<string, { count: number; liked: boolean }>;

function initLikeState(videos: FeedVideo[]): LikeState {
  const s: LikeState = {};
  for (const v of videos) s[v.id] = { count: Number(v.likeCount ?? 0), liked: false };
  return s;
}

function IntroSlide() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-black">
      <div className="px-6 text-center">
        <div className="text-white text-xl font-semibold">Scroll to view videos</div>
        <div className="mt-2 text-white/70 text-sm">
          Swipe / scroll up to start watching. This intro helps the first video load smoothly.
        </div>

        <div className="mt-6 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-white/35 border-t-transparent animate-spin" />
        </div>

        <div className="mt-6 text-white/50 text-xs">
          Tip: enable sound with the Sound button on the right.
        </div>
      </div>
    </div>
  );
}

/**
 * TikTok-style feed using native scroll + snap.
 * We prepend an intro slide at index 0.
 * Real videos start at index 1, which gives the browser time to warm up/preload.
 */
export function VideoFeedClient({ eventId, videos }: Props) {
  const [likes, setLikes] = useState<LikeState>(() => initLikeState(videos));
  useEffect(() => {
    setLikes((prev) => {
      const next: LikeState = { ...prev };
      for (const v of videos) {
        if (!next[v.id]) next[v.id] = { count: Number(v.likeCount ?? 0), liked: false };
      }
      return next;
    });
  }, [videos]);

  // total slides = intro + videos
  const totalSlides = videos.length + 1;

  // currentIndex is the slide index INCLUDING intro:
  // 0 = intro, 1 = first video, 2 = second video, ...
  const [currentIndex, setCurrentIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Warm up: aggressively preload the first REAL video in the background.
  useEffect(() => {
    if (!videos.length) return;
    const vid = document.createElement("video");
    vid.src = videos[0].src;
    vid.preload = "auto";
    vid.muted = true;
    vid.playsInline = true;
    try {
      vid.load();
    } catch {}
  }, [videos]);

  // IntersectionObserver for which slide is active
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isNaN(i)) setCurrentIndex(i);
        }
      },
      { root: container, threshold: 0.6 }
    );

    const slides = container.querySelectorAll<HTMLDivElement>("[data-index]");
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [totalSlides]);

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
        // keep optimistic update
      }
    },
    [eventId]
  );

  if (!videos.length) {
    return (
      <div className="w-full flex items-center justify-center text-sm opacity-70">
        No videos
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* INTRO SLIDE (index 0) */}
      <div data-index={0} className="h-[100dvh] w-full snap-start flex items-center justify-center">
        <VideoFrame>
          <IntroSlide />
        </VideoFrame>
      </div>

      {/* VIDEO SLIDES (start at index 1) */}
      {videos.map((video, idx) => {
        const slideIndex = idx + 1; // shift by 1 because of intro
        const likeState = likes[video.id] ?? { count: Number(video.likeCount ?? 0), liked: false };

        // Active if currentIndex matches the slideIndex (intro is 0)
        const isActive = currentIndex === slideIndex;

        // Preload current + neighbors (relative to slides)
        // We compare slide indices, not video indices
        const preloadType: "auto" | "metadata" =
          Math.abs(currentIndex - slideIndex) <= 1 ? "auto" : "metadata";

        return (
          <div
            key={video.id}
            data-index={slideIndex}
            className="h-[100dvh] w-full snap-start flex items-center justify-center"
          >
            <VideoFrame>
              <VideoCardSound
                active={isActive}
                preload={preloadType}
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
              />
            </VideoFrame>
          </div>
        );
      })}

      {/* Slide indicator */}
      <div className="absolute right-4 top-4 px-2 py-1 rounded-lg bg-black/40 text-white/80 text-xs">
        {currentIndex + 1}/{totalSlides}
      </div>
    </div>
  );
}

export default VideoFeedClient;
