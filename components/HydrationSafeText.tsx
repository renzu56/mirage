"use client";

import React from "react";

/**
 * Wrap ONLY the time-changing part with this.
 * Example:
 *   <HydrationSafeText>{seconds}</HydrationSafeText>
 */
export function HydrationSafeText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span suppressHydrationWarning className={className}>
      {children}
    </span>
  );
}
