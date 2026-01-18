import React from "react";

/**
 * Original sizing: full width, 78svh height (like your first working version).
 */
export function VideoFrame({ children }: { children: React.ReactNode }) {
  return <div className="relative h-[78svh] w-full overflow-hidden bg-black">{children}</div>;
}
