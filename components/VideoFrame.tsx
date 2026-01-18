import React from "react";

/**
 * Full-screen (slide-sized) frame for TikTok style.
 * Keeps layout consistent and ensures overlays (desc/links) are always visible.
 */
export function VideoFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {children}
    </div>
  );
}
