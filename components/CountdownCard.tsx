'use client'

import { useEffect, useMemo, useState } from 'react'
import { fmt2, msToParts } from '@/lib/time'

export default function CountdownCard({
  title,
  targetISO,
}: {
  title: string
  targetISO: string
}) {
  const target = useMemo(() => new Date(targetISO).getTime(), [targetISO])
  // Hydration-safe: keep initial render deterministic between server + client.
  // (If we call Date.now() during render, the server and client timestamps will differ
  // and React will warn: "Text content did not match".)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  // On the server (and before hydration) we don't have a reliable "now".
  // Render a stable placeholder so SSR HTML matches the first client render.
  const remaining = now === null ? 0 : Math.max(0, target - now)
  const parts = msToParts(remaining)

  return (
    <div className="aero-glass rounded-3xl p-6 md:p-8 w-full max-w-xl animate-floaty">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <span className="aero-chip rounded-full px-3 py-1 text-xs md:text-sm">
          swipe-only
        </span>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        <TimeBox label="Tage" value={String(parts.days)} />
        <TimeBox label="Std" value={fmt2(parts.hours)} />
        <TimeBox label="Min" value={fmt2(parts.minutes)} />
        <TimeBox label="Sek" value={fmt2(parts.seconds)} />
      </div>

      <p className="mt-6 text-sm md:text-base text-black/70">
        Wenn das Event live ist, sind genau ~300 Musikvideos freigeschaltet. Keine Kommentare. Keine Profile.
        Einfach schauen.
      </p>
    </div>
  )
}

function TimeBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="aero-chip rounded-2xl p-3 text-center">
      <div className="text-2xl md:text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-black/60">{label}</div>
    </div>
  )
}
