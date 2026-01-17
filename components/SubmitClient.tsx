'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'
import type { SubmissionRow } from '@/lib/types'

export default function SubmitClient({
  eventId,
  eventTitle,
}: {
  eventId: string
  eventTitle: string
}) {
  const router = useRouter()
  const sb = useMemo(() => supabaseBrowser(), [])

  const [ready, setReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [sub, setSub] = useState<SubmissionRow | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  /**
   * HARD FIX FOR MOBILE SCROLL:
   * If the TikTok feed page ever set body overflow hidden / touch-action none,
   * it can persist depending on navigation/layout behavior.
   * This resets the page to be scrollable.
   */
  useEffect(() => {
    const body = document.body
    const html = document.documentElement

    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTouchAction: (body.style as any).touchAction ?? '',
      htmlOverflow: html.style.overflow,
      htmlTouchAction: (html.style as any).touchAction ?? '',
    }

    body.style.overflow = 'auto'
    body.style.position = 'static'
    ;(body.style as any).touchAction = 'pan-y'

    html.style.overflow = 'auto'
    ;(html.style as any).touchAction = 'pan-y'

    return () => {
      body.style.overflow = prev.bodyOverflow
      body.style.position = prev.bodyPosition
      ;(body.style as any).touchAction = prev.bodyTouchAction

      html.style.overflow = prev.htmlOverflow
      ;(html.style as any).touchAction = prev.htmlTouchAction
    }
  }, [])

  // ---- auth bootstrap ----
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await sb.auth.getSession()
      let session = data.session
      if (!session) {
        const r = await sb.auth.signInAnonymously()
        session = r.data.session ?? null
      }
      if (!mounted) return
      setToken(session?.access_token ?? null)
      setUserId(session?.user?.id ?? null)
      setReady(true)
    })()
    return () => {
      mounted = false
    }
  }, [sb])

  // ---- always load submission deterministically (event + user) ----
  const loadSubmission = async (uid: string) => {
    const { data, error } = await sb
      .from('submissions')
      .select(
        'id,event_id,user_id,display_name,description,spotify_url,soundcloud_url,instagram_url,video_path,published'
      )
      .eq('event_id', eventId)
      .eq('user_id', uid)
      .maybeSingle()

    if (!error && data) setSub(data as SubmissionRow)
    if (!data) setSub(null)
  }

  useEffect(() => {
    if (!ready) return
    if (!userId) return
    void loadSubmission(userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, eventId])

  // ---- redeem ----
  const redeem = async () => {
    setRedeemError(null)
    setSaveMsg(null)

    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 4) {
      setRedeemError('Please enter a valid code.')
      return
    }
    if (!token || !userId) {
      setRedeemError('No login token found. Please reload the page.')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmed }),
        cache: 'no-store',
      })

      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error ?? 'Invalid code')

      await loadSubmission(userId)
      router.refresh()

      setSaveMsg('Code redeemed ✓')
      setTimeout(() => setSaveMsg(null), 1500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid code'
      setRedeemError(msg)
    } finally {
      setBusy(false)
    }
  }

  const save = async (patch: Partial<SubmissionRow>) => {
    if (!sub) return
    setBusy(true)
    setSaveMsg(null)
    try {
      const { data, error } = await sb
        .from('submissions')
        .update(patch)
        .eq('id', sub.id)
        .select(
          'id,event_id,user_id,display_name,description,spotify_url,soundcloud_url,instagram_url,video_path,published'
        )
        .single()
      if (error) throw error
      setSub(data as SubmissionRow)
      setSaveMsg('Saved ✓')
      setTimeout(() => setSaveMsg(null), 1500)
      router.refresh()
    } catch {
      setSaveMsg('Error while saving')
    } finally {
      setBusy(false)
    }
  }

  const uploadVideo = async (file: File) => {
    if (!sub) return
    setBusy(true)
    setSaveMsg(null)

    try {
      if (!token) throw new Error('No login token found. Please reload the page.')

      const form = new FormData()
      form.append('file', file)
      form.append('eventId', eventId)

      const res = await fetch('/api/upload-video', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Upload failed')

      await save({ video_path: json.path, published: true })
    } catch (e: any) {
      setSaveMsg(e?.message ?? 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4">
        <div className="aero-glass rounded-3xl p-6">Loading…</div>
      </main>
    )
  }

  return (
    <main
      className="min-h-[100dvh] w-full overflow-x-hidden overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      style={{
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
      }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="aero-glass rounded-3xl px-4 py-3">
            <div className="text-xs text-black/60">Submission</div>
            <div className="text-lg font-semibold">{eventTitle}</div>
          </div>
          <Link className="aero-btn rounded-2xl px-3 py-2 text-sm font-semibold" href="/">
            Back
          </Link>
        </div>

        {!sub ? (
          <div className="mt-6 aero-glass rounded-3xl p-6">
            <div className="text-lg font-semibold">Enter your one-time code</div>
            <p className="mt-2 text-sm text-black/70">
              You will receive a code that corresponds to exactly one slot (~300 total) for this event.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CODE"
                className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm font-semibold tracking-widest outline-none"
              />
              <button
                disabled={busy || code.trim().length < 4}
                onClick={redeem}
                className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                Redeem
              </button>
            </div>

            {redeemError ? <p className="mt-3 text-sm text-red-800">{redeemError}</p> : null}
            {saveMsg ? <p className="mt-3 text-sm text-black/70">{saveMsg}</p> : null}

            <div className="mt-6 text-xs text-black/60">
              Privacy note: In this MVP likes are counted via IP-hash (no comments, no profiles).
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="aero-glass rounded-3xl p-6">
              <div className="text-lg font-semibold">Your submission</div>
              <p className="mt-1 text-sm text-black/70">
                Fill in the details, upload a video, done. When the event starts, your video becomes available in the feed.
              </p>

              <FormRow label="Artist / Act name">
                <input
                  value={sub.display_name}
                  onChange={(e) => setSub((s) => (s ? { ...s, display_name: e.target.value } : s))}
                  className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                />
              </FormRow>

              <FormRow label="Description">
                <textarea
                  value={sub.description ?? ''}
                  onChange={(e) => setSub((s) => (s ? { ...s, description: e.target.value } : s))}
                  rows={4}
                  className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                />
              </FormRow>

              <div className="grid gap-3 md:grid-cols-3">
                <FormRow label="Spotify link">
                  <input
                    value={sub.spotify_url ?? ''}
                    onChange={(e) => setSub((s) => (s ? { ...s, spotify_url: e.target.value } : s))}
                    className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                  />
                </FormRow>
                <FormRow label="SoundCloud link">
                  <input
                    value={sub.soundcloud_url ?? ''}
                    onChange={(e) => setSub((s) => (s ? { ...s, soundcloud_url: e.target.value } : s))}
                    className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                  />
                </FormRow>
                <FormRow label="Instagram link">
                  <input
                    value={sub.instagram_url ?? ''}
                    onChange={(e) => setSub((s) => (s ? { ...s, instagram_url: e.target.value } : s))}
                    className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                  />
                </FormRow>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={() =>
                    save({
                      display_name: sub.display_name,
                      description: sub.description,
                      spotify_url: sub.spotify_url,
                      soundcloud_url: sub.soundcloud_url,
                      instagram_url: sub.instagram_url,
                    })
                  }
                  className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
                >
                  Save
                </button>

                <button
                  disabled={busy}
                  onClick={() => save({ published: true })}
                  className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
                >
                  Publish
                </button>

                <button
                  disabled={busy}
                  onClick={() => save({ published: false })}
                  className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
                >
                  Hide
                </button>

                {saveMsg ? <span className="text-sm text-black/70">{saveMsg}</span> : null}
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold">Video upload (mp4)</div>
                <p className="mt-1 text-xs text-black/60">
                  Tip: 9:16, under 50 MB (free-tier friendly). Bucket is private; live feed uses signed URLs.
                </p>

                <input
                  disabled={busy}
                  type="file"
                  accept="video/mp4,video/quicktime,video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadVideo(f)
                  }}
                  className="mt-2 block w-full text-sm"
                />

                <div className="mt-2 text-xs text-black/60">
                  Status: {sub.video_path ? 'Video uploaded' : 'No video yet'} ·{' '}
                  {sub.published ? 'published' : 'not published'}
                </div>
              </div>
            </div>

            <div className="aero-glass rounded-3xl p-6">
              <div className="text-sm font-semibold">What happens next?</div>
              <ul className="mt-2 text-sm text-black/70 list-disc pl-5 space-y-1">
                <li>You are assigned to one slot (via code).</li>
                <li>When the event starts, all published videos become available.</li>
                <li>Likes are counted via IP-hash per video (1 like per IP).</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block">
      <div className="mb-1 text-xs font-semibold text-black/60">{label}</div>
      {children}
    </label>
  )
}
