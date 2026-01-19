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

type LikeState = Record<string, { count: number; liked: boolean }>;

function initLikeState(videos: FeedVideo[]): LikeState {
  const s: LikeState = {};
  for (const v of videos) s[v.id] = { count: Number(v.likeCount ?? 0), liked: false };
  return s;
}

function IntroSlide() {
  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center">
      <div className="px-6 text-center">
        <div className="text-white text-xl font-semibold">Scroll to view videos</div>
        <div className="mt-2 text-white/70 text-sm">Swipe / scroll up to start watching.</div>
        <div className="mt-6 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-white/35 border-t-transparent animate-spin" />
        </div>
      </div>
    </div>
  );
}

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

  // Slide index including intro: 0 intro, 1 first video, ...
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Warm up first video (helps some devices start faster)
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

  // IntersectionObserver for active slide
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
  }, [videos.length]);

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
      } catch {}
    },
    [eventId]
  );

  if (!videos.length) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center text-sm opacity-70 bg-black text-white">
        No videos
      </div>
    );
  }

  const totalSlides = videos.length + 1;

  return (
    <div
      ref={containerRef}
      className="relative h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory"
      style={{
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
      }}
    >
      {/* Intro */}
      <div data-index={0} className="h-[100dvh] w-full snap-start flex items-center justify-center">
        <div className="h-[78svh] w-full flex items-center justify-center">
          <VideoFrame>
            <IntroSlide />
          </VideoFrame>
        </div>
      </div>

      {/* Videos */}
      {videos.map((video, idx) => {
        const slideIndex = idx + 1;
        const likeState = likes[video.id] ?? { count: Number(video.likeCount ?? 0), liked: false };
        const isActive = currentIndex === slideIndex;

        const preloadType: "auto" | "metadata" =
          Math.abs(currentIndex - slideIndex) <= 1 ? "auto" : "metadata";

        return (
          <div
            key={video.id}
            data-index={slideIndex}
            className="h-[100dvh] w-full snap-start flex items-center justify-center"
          >
            <div className="h-[78svh] w-full flex items-center justify-center">
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
          </div>
        );
      })}

      {/* Indicator */}
      <div className="absolute right-4 top-4 px-2 py-1 rounded-lg bg-black/40 text-white/80 text-xs">
        {currentIndex + 1}/{totalSlides}
      </div>

      {/* Hide scrollbar (webkit) */}
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default VideoFeedClient;
