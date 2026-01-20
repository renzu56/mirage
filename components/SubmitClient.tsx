"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { SubmissionRow } from "@/lib/types";

export default function SubmitClient({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const router = useRouter();
  const sb = useMemo(() => supabaseBrowser(), []);

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sub, setSub] = useState<SubmissionRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);

  // iOS scroll “stuck” protection (undo overflow hidden from feed pages)
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTouchAction: (body.style as any).touchAction ?? "",
      htmlOverflow: html.style.overflow,
      htmlTouchAction: (html.style as any).touchAction ?? "",
    };

    body.style.overflow = "auto";
    body.style.position = "static";
    (body.style as any).touchAction = "pan-y";

    html.style.overflow = "auto";
    (html.style as any).touchAction = "pan-y";

    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      (body.style as any).touchAction = prev.bodyTouchAction;

      html.style.overflow = prev.htmlOverflow;
      (html.style as any).touchAction = prev.htmlTouchAction;
    };
  }, []);

  // ---- auth bootstrap ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await sb.auth.getSession();
      let session = data.session;
      if (!session) {
        const r = await sb.auth.signInAnonymously();
        session = r.data.session ?? null;
      }
      if (!mounted) return;

      setToken(session?.access_token ?? null);
      setUserId(session?.user?.id ?? null);
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, [sb]);

  // ---- load submission deterministically (event + user) ----
  const loadSubmission = async (uid: string) => {
    const { data, error } = await sb
      .from("submissions")
      .select(
        "id,event_id,user_id,display_name,description,spotify_url,soundcloud_url,instagram_url,video_path,published"
      )
      .eq("event_id", eventId)
      .eq("user_id", uid)
      .maybeSingle();

    if (error) console.error("LOAD SUBMISSION ERROR:", error);

    if (!error && data) setSub(data as SubmissionRow);
    if (!data) setSub(null);
  };

  useEffect(() => {
    if (!ready) return;
    if (!userId) return;
    void loadSubmission(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, eventId]);

  // ---- redeem ----
  const redeem = async () => {
    setRedeemError(null);
    setMsg(null);

    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setRedeemError("Please enter a valid code.");
      return;
    }
    if (!token || !userId) {
      setRedeemError("No login token found. Please reload the page.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmed }),
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error ?? "Invalid code");

      await loadSubmission(userId);
      router.refresh();

      setMsg("Code redeemed ✓");
      setTimeout(() => setMsg(null), 1500);
    } catch (e: any) {
      console.error("REDEEM FAILED:", e);
      setRedeemError(e?.message ?? "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  // ---- save draft (optional): saves text fields only (no video, not published) ----
  const saveDraft = async () => {
    if (!sub) {
      setMsg("Redeem a code first.");
      return;
    }
    setBusy(true);
    setMsg(null);

    try {
      const { data, error } = await sb
        .from("submissions")
        .update({
          display_name: sub.display_name || "Unnamed act",
          description: sub.description ?? null,
          spotify_url: sub.spotify_url ?? null,
          soundcloud_url: sub.soundcloud_url ?? null,
          instagram_url: sub.instagram_url ?? null,
        })
        .eq("id", sub.id)
        .select(
          "id,event_id,user_id,display_name,description,spotify_url,soundcloud_url,instagram_url,video_path,published"
        )
        .single();

      if (error) throw error;

      setSub(data as SubmissionRow);
      setMsg("Saved ✓");
      setTimeout(() => setMsg(null), 1500);
      router.refresh();
    } catch (e: any) {
      console.error("SAVE DRAFT FAILED:", e);
      setMsg(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  // ---- publish (single button): upload + save all fields + publish ----
  // IMPORTANT: This calls /api/upload-video (NOT /api/publish)
  const publish = async () => {
    if (!sub) {
      setMsg("Redeem a code first.");
      return;
    }
    if (!file) {
      setMsg("Please choose a video first (.mp4 or .mov).");
      return;
    }
    if (!token || !userId) {
      setMsg("No login token found. Please reload the page.");
      return;
    }

    setBusy(true);
    setMsg(null);

    try {
      const form = new FormData();
      form.append("eventId", eventId);
      form.append("file", file);

      // Send current inputs (server will persist them + set published=true)
      form.append("display_name", sub.display_name || "");
      form.append("description", sub.description ?? "");
      form.append("spotify_url", sub.spotify_url ?? "");
      form.append("soundcloud_url", sub.soundcloud_url ?? "");
      form.append("instagram_url", sub.instagram_url ?? "");

      const res = await fetch("/api/upload-video", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        console.error("UPLOAD/PUBLISH API ERROR:", json);
        throw new Error(json?.error ?? "Publish failed");
      }

      if (json?.submission) {
        setSub(json.submission as SubmissionRow);
      } else {
        // Fallback: reload from DB
        await loadSubmission(userId);
      }

      setMsg("Published ✓");
      setTimeout(() => setMsg(null), 1500);
      router.refresh();
    } catch (e: any) {
      console.error("PUBLISH FAILED:", e);
      setMsg(e?.message ?? "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  // ---- hide (unpublish) ----
  const hide = async () => {
    if (!sub) return;
    setBusy(true);
    setMsg(null);

    try {
      const { data, error } = await sb
        .from("submissions")
        .update({ published: false })
        .eq("id", sub.id)
        .select(
          "id,event_id,user_id,display_name,description,spotify_url,soundcloud_url,instagram_url,video_path,published"
        )
        .single();

      if (error) throw error;

      setSub(data as SubmissionRow);
      setMsg("Hidden ✓");
      setTimeout(() => setMsg(null), 1500);
      router.refresh();
    } catch (e: any) {
      console.error("HIDE FAILED:", e);
      setMsg(e?.message ?? "Hide failed");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4">
        <div className="aero-glass rounded-3xl p-6">Loading…</div>
      </main>
    );
  }

  return (
    <main
      className="min-h-[100dvh] w-full overflow-x-hidden p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
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
            {msg ? <p className="mt-3 text-sm text-black/70">{msg}</p> : null}
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="aero-glass rounded-3xl p-6">
              <div className="text-lg font-semibold">Your submission</div>

              <FormRow label="Artist / Act name">
                <input
                  value={sub.display_name}
                  onChange={(e) => setSub((s) => (s ? { ...s, display_name: e.target.value } : s))}
                  className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                />
              </FormRow>

              <FormRow label="Description">
                <textarea
                  value={sub.description ?? ""}
                  onChange={(e) => setSub((s) => (s ? { ...s, description: e.target.value } : s))}
                  rows={4}
                  className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                />
              </FormRow>

              <div className="grid gap-3 md:grid-cols-3">
                <FormRow label="Spotify link">
                  <input
                    value={sub.spotify_url ?? ""}
                    onChange={(e) => setSub((s) => (s ? { ...s, spotify_url: e.target.value } : s))}
                    className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                  />
                </FormRow>
                <FormRow label="SoundCloud link">
                  <input
                    value={sub.soundcloud_url ?? ""}
                    onChange={(e) => setSub((s) => (s ? { ...s, soundcloud_url: e.target.value } : s))}
                    className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                  />
                </FormRow>
                <FormRow label="Instagram link">
                  <input
                    value={sub.instagram_url ?? ""}
                    onChange={(e) => setSub((s) => (s ? { ...s, instagram_url: e.target.value } : s))}
                    className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm outline-none"
                  />
                </FormRow>
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold">Video (.mp4 or .mov)</div>
                <input
                  disabled={busy}
                  type="file"
                  accept="video/mp4,video/quicktime,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-2 block w-full text-sm"
                />
                <div className="mt-2 text-xs text-black/60">
                  Selected: {file ? file.name : "none"} · Stored: {sub.video_path ? "yes" : "no"} ·{" "}
                  {sub.published ? "published" : "not published"}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={saveDraft}
                  className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
                >
                  Save draft
                </button>

                <button
                  disabled={busy || !file}
                  onClick={publish}
                  className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  Publish
                </button>

                <button
                  disabled={busy}
                  onClick={hide}
                  className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
                >
                  Hide
                </button>

                {msg ? <span className="text-sm text-black/70">{msg}</span> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block">
      <div className="mb-1 text-xs font-semibold text-black/60">{label}</div>
      {children}
    </label>
  );
}
