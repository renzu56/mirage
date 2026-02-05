"use client";

import React, { useEffect, useMemo, useState } from "react";

function clamp(n: number) {
  return n < 0 ? 0 : n;
}

function split(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function Box({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-white/5 border border-white/10">
      <div className="text-2xl font-semibold tabular-nums">
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

/**
 * Client-only countdown card (no hydration mismatch).
 */
export function CountdownCardClient({ targetIso }: { targetIso: string }) {
  const target = useMemo(() => new Date(targetIso).getTime(), [targetIso]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = now == null ? null : clamp(target - now);
  const parts = remaining == null ? null : split(remaining);

  return (
    <div className="w-full flex items-center justify-center">
      <div className="flex gap-2">
        <Box label="Days" value={parts?.days ?? 0} />
        <Box label="Hours" value={parts?.hours ?? 0} />
        <Box label="Min" value={parts?.minutes ?? 0} />
        <Box label="Sec" value={parts?.seconds ?? 0} />
      </div>
    </div>
  );
}
