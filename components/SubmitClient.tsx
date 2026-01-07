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
      setRedeemError('Bitte gültigen Code eingeben.')
      return
    }
    if (!token || !userId) {
      setRedeemError('Kein Login-Token. Bitte Seite neu laden.')
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
      if (!res.ok) throw new Error(json?.error ?? 'Code ungültig')

      // Reload submission and refresh server components so the page state is consistent
      await loadSubmission(userId)
      router.refresh()

      setSaveMsg('Code eingelöst ✓')
      setTimeout(() => setSaveMsg(null), 1500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Code ungültig'
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
      setSaveMsg('Gespeichert ✓')
      setTimeout(() => setSaveMsg(null), 1500)
      router.refresh()
    } catch {
      setSaveMsg('Fehler beim Speichern')
    } finally {
      setBusy(false)
    }
  }

 const uploadVideo = async (file: File) => {
  if (!sub) return;
  setBusy(true);
  setSaveMsg(null);

  try {
    if (!token) throw new Error("Kein Login-Token. Bitte Seite neu laden.");

    const form = new FormData();
    form.append("file", file);
    form.append("eventId", eventId);

    const res = await fetch("/api/upload-video", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Upload fehlgeschlagen");

    await save({ video_path: json.path, published: true });
  } catch (e: any) {
    setSaveMsg(e?.message ?? "Upload fehlgeschlagen");
  } finally {
    setBusy(false);
  }
};


  if (!ready) {
    return (
      <main className="flex h-[100svh] items-center justify-center p-6">
        <div className="aero-glass rounded-3xl p-6">Loading…</div>
      </main>
    )
  }

  return (
    <main className="relative h-[100svh] w-full overflow-hidden p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="aero-glass rounded-3xl px-4 py-3">
            <div className="text-xs text-black/60">Submission</div>
            <div className="text-lg font-semibold">{eventTitle}</div>
          </div>
          <Link className="aero-btn rounded-2xl px-3 py-2 text-sm font-semibold" href="/">
            Zurück
          </Link>
        </div>

        {!sub ? (
          <div className="mt-6 aero-glass rounded-3xl p-6">
            <div className="text-lg font-semibold">Einmaligen Code eingeben</div>
            <p className="mt-2 text-sm text-black/70">
              Du bekommst einen Code, der genau einem Slot (von ~300) für dieses Event entspricht.
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
                Einlösen
              </button>
            </div>

            {redeemError ? <p className="mt-3 text-sm text-red-800">{redeemError}</p> : null}
            {saveMsg ? <p className="mt-3 text-sm text-black/70">{saveMsg}</p> : null}

            <div className="mt-6 text-xs text-black/60">
              Datenschutz-Hinweis: In diesem MVP werden Likes per IP-Hash gezählt (keine Kommentare, keine Profile).
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="aero-glass rounded-3xl p-6">
              <div className="text-lg font-semibold">Dein Eintrag</div>
              <p className="mt-1 text-sm text-black/70">
                Fülle alles aus, lade ein Video hoch, fertig. Sobald das Event startet, wird dein Video freigeschaltet.
              </p>

              <FormRow label="Artist/Act Name">
                <input
                  value={sub.display_name}
                  onChange={(e) => setSub((s) => (s ? { ...s, display_name: e.target.value } : s))}
                  className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                />
              </FormRow>

              <FormRow label="Beschreibung">
                <textarea
                  value={sub.description ?? ''}
                  onChange={(e) => setSub((s) => (s ? { ...s, description: e.target.value } : s))}
                  rows={4}
                  className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                />
              </FormRow>

              <div className="grid gap-3 md:grid-cols-3">
                <FormRow label="Spotify Link">
                  <input
                    value={sub.spotify_url ?? ''}
                    onChange={(e) => setSub((s) => (s ? { ...s, spotify_url: e.target.value } : s))}
                    className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                  />
                </FormRow>
                <FormRow label="SoundCloud Link">
                  <input
                    value={sub.soundcloud_url ?? ''}
                    onChange={(e) => setSub((s) => (s ? { ...s, soundcloud_url: e.target.value } : s))}
                    className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                  />
                </FormRow>
                <FormRow label="Instagram Link">
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
                  Speichern
                </button>

                <button
                  disabled={busy}
                  onClick={() => save({ published: true })}
                  className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
                >
                  Veröffentlichen
                </button>

                <button
                  disabled={busy}
                  onClick={() => save({ published: false })}
                  className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
                >
                  Verstecken
                </button>

                {saveMsg ? <span className="text-sm text-black/70">{saveMsg}</span> : null}
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold">Video Upload (mp4)</div>
                <p className="mt-1 text-xs text-black/60">
                  Tipp: 9:16, unter 50 MB (Free Tier friendly). Bucket ist privat; live-feed nutzt Signed URLs.
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
                  Status: {sub.video_path ? 'Video hochgeladen' : 'Noch kein Video'} ·{' '}
                  {sub.published ? 'veröffentlicht' : 'nicht veröffentlicht'}
                </div>
              </div>
            </div>

            <div className="aero-glass rounded-3xl p-6">
              <div className="text-sm font-semibold">Was passiert dann?</div>
              <ul className="mt-2 text-sm text-black/70 list-disc pl-5 space-y-1">
                <li>Du bist einem Slot (Code) zugeordnet.</li>
                <li>Wenn das Event startet, werden alle veröffentlichten Videos freigeschaltet.</li>
                <li>Likes werden per IP-Hash pro Video gezählt (1 Like pro IP).</li>
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
