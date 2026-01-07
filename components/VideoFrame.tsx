import React from "react";

/**
 * Visual container for a single TikTok-style video.
 * Intentionally NOT full-screen: keeps big videos from feeling cropped/overwhelming.
 */
export function VideoFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        "relative w-[min(360px,92vw)] h-[min(640px,72vh)] overflow-hidden rounded-2xl bg-black shadow-xl"
      }
    >
      {children}
    </div>
  );
}
