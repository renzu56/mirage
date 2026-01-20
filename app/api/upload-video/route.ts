import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function extFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp4")) return "mp4";
  if (lower.endsWith(".mov")) return "mov";
  return null;
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
    }

    const form = await req.formData();

    const eventId = String(form.get("eventId") || "");
    const file = form.get("file");

    const display_name = String(form.get("display_name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const spotify_url = String(form.get("spotify_url") || "").trim();
    const soundcloud_url = String(form.get("soundcloud_url") || "").trim();
    const instagram_url = String(form.get("instagram_url") || "").trim();

    if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    const ext =
      extFromName(file.name) ||
      (file.type === "video/mp4" ? "mp4" : file.type === "video/quicktime" ? "mov" : null);

    if (!ext) {
      return NextResponse.json({ error: "Unsupported file type. Upload .mp4 or .mov" }, { status: 400 });
    }

    // optional: limit size (adjust if needed)
    const MAX_MB = 250;
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_MB) {
      return NextResponse.json(
        { error: `File too large (${sizeMb.toFixed(1)}MB). Max ${MAX_MB}MB.` },
        { status: 413 }
      );
    }

    const sb = supabaseAdmin();

    // Resolve user from Bearer token (works with anonymous auth too)
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Ensure submission exists for this event+user (redeem must be done first)
    const { data: submission, error: subErr } = await sb
      .from("submissions")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (subErr) return NextResponse.json({ error: "Failed to load submission", details: subErr }, { status: 500 });
    if (!submission?.id) {
      return NextResponse.json({ error: "No submission found. Redeem a code first." }, { status: 400 });
    }

    // Upload to Storage bucket "videos"
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const ts = Date.now();
    const path = `${eventId}/${userId}/${ts}-${safeName}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await sb.storage.from("videos").upload(path, bytes, {
      contentType: file.type || (ext === "mp4" ? "video/mp4" : "video/quicktime"),
      upsert: true,
    });

    if (uploadErr) {
      return NextResponse.json({ error: "Upload failed", details: uploadErr }, { status: 500 });
    }

    // Update DB row with ALL fields + publish
    const patch: any = {
      display_name: display_name || "Unnamed act",
      description: description || null,
      spotify_url: spotify_url || null,
      soundcloud_url: soundcloud_url || null,
      instagram_url: instagram_url || null,
      video_path: path,
      published: true,
    };

    const { data: updated, error: updErr } = await sb
      .from("submissions")
      .update(patch)
      .eq("id", submission.id)
      .select(
        "id,event_id,user_id,display_name,description,spotify_url,soundcloud_url,instagram_url,video_path,published"
      )
      .single();

    if (updErr) {
      return NextResponse.json({ error: "Failed to update submission", details: updErr }, { status: 500 });
    }

    return NextResponse.json({ ok: true, submission: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
