import React from "react";

/**
 * Visual container for a single TikTok-style video.
 * Keep sizing consistent across devices. Parent sets the height.
 */
export function VideoFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full w-[min(520px,96vw)] overflow-hidden rounded-2xl bg-black shadow-xl">
      {children}
    </div>
  );
}
