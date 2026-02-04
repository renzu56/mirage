'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TouchEvent, WheelEvent } from 'react'
import type { FeedItem } from '@/lib/types'

export default function EventClient({
  eventTitle,
  eventId,
  initialFeed,
}: {
  eventTitle: string
  eventId: string
  initialFeed: FeedItem[]
}) {
  const [feed, setFeed] = useState<FeedItem[]>(initialFeed)
  const [idx, setIdx] = useState(0)
  const [muted, setMuted] = useState(true)
  const [likeBusy, setLikeBusy] = useState(false)

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const wheelLock = useRef(0)

  const cur = feed[idx]
  const total = feed.length

  const clampIndex = useCallback(
    (n: number) => Math.max(0, Math.min(Math.max(total - 1, 0), n)),
    [total]
  )

  const go = useCallback(
    (delta: number) => {
      setMuted(true)
      setIdx((v) => clampIndex(v + delta))
    },
    [clampIndex]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') go(1)
      if (e.key === 'ArrowUp' || e.key === 'k') go(-1)
      if (e.key === ' ') setMuted((m) => !m)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    const s = touchStart.current
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    touchStart.current = null

    // Up/down swipe like TikTok
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
      if (dy < 0) go(1)
      else go(-1)
      return
    }

    // Left/right swipe like Tinder
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx < 0) go(1)
      else go(-1)
      return
    }

    // Tap toggles sound
    setMuted((m) => !m)
  }

  const onWheel = (e: WheelEvent<HTMLElement>) => {
    const now = Date.now()
    if (now < wheelLock.current) return
    if (Math.abs(e.deltaY) < 30) return
    wheelLock.current = now + 400
    if (e.deltaY > 0) go(1)
    else go(-1)
  }

  const canLike = useMemo(() => Boolean(cur), [cur])

  const toggleLike = async () => {
    if (!cur || likeBusy) return
    setLikeBusy(true)
    try {
      const res = await fetch('/api/like', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId, submissionId: cur.submission_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Like failed')

      setFeed((prev) =>
        prev.map((it) =>
          it.submission_id === cur.submission_id
            ? { ...it, like_count: Number(json.like_count ?? it.like_count) }
            : it
        )
      )
    } catch {
      // ignore for MVP
    } finally {
      setLikeBusy(false)
    }
  }

  if (total === 0) {
    return (
      <main className="flex h-[100svh] items-center justify-center p-6">
        <div className="aero-glass rounded-3xl p-6 max-w-md text-center">
          <div className="text-lg font-semibold">No Videos</div>
          <p className="mt-2 text-sm text-black/70">Wait until Content gets posted</p>
          <div className="mt-4">
            <Link className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold" href="/">
              Zurück
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main
      className="relative h-[100svh] w-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      <video
        key={cur.submission_id}
        className="absolute inset-0 h-full w-full object-cover"
        src={cur.video_url}
        playsInline
        autoPlay
        loop
        muted={muted}
        controls={false}
      />

      {/* overlays */}
      <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-3">
        <div className="aero-glass rounded-2xl px-3 py-2">
          <div className="text-xs text-black/60">{eventTitle}</div>
          <div className="text-sm font-semibold tabular-nums">
            {idx + 1} / {total}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="aero-btn rounded-2xl px-3 py-2 text-sm font-semibold"
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <Link className="aero-btn rounded-2xl px-3 py-2 text-sm font-semibold" href="/">
            ✕
          </Link>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="aero-glass rounded-3xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">{cur.display_name}</div>
              {cur.description ? (
                <p className="mt-1 text-sm text-black/70 overflow-hidden max-h-16">{cur.description}</p>
              ) : null}
            </div>

            <button
              disabled={!canLike || likeBusy}
              onClick={toggleLike}
              className="aero-btn rounded-2xl px-3 py-2 text-sm font-semibold whitespace-nowrap"
            >
              ❤ {cur.like_count}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {cur.spotify_url ? (
              <ExternalBtn href={cur.spotify_url} label="Spotify" />
            ) : null}
            {cur.soundcloud_url ? (
              <ExternalBtn href={cur.soundcloud_url} label="SoundCloud" />
            ) : null}
            {cur.instagram_url ? (
              <ExternalBtn href={cur.instagram_url} label="Instagram" />
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold" onClick={() => go(-1)}>
              ◀ zurück
            </button>
            <div className="text-xs text-black/60">Swipe</div>
            <button className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold" onClick={() => go(1)}>
              weiter ▶
            </button>
          </div>
        </div>
      </div>

      {muted ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

        </div>
      ) : null}
    </main>
  )
}

function ExternalBtn({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="aero-chip rounded-full px-3 py-2 text-xs font-semibold"
    >
      {label} ↗
    </a>
  )
}
