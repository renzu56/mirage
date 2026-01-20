import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs"; // Netlify/Next: ensure Node runtime

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
    const file = form.get("file");
    const eventId = String(form.get("eventId") || "");

    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const ext = extFromName(file.name) || (file.type === "video/mp4" ? "mp4" : file.type === "video/quicktime" ? "mov" : null);
    if (!ext) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload .mp4 or .mov" },
        { status: 400 }
      );
    }

    // Validate size (optional but recommended for Netlify/serverless limits)
    // e.g. 200 MB hard stop (adjust)
    const MAX_MB = 200;
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_MB) {
      return NextResponse.json({ error: `File too large (${sizeMb.toFixed(1)}MB). Max ${MAX_MB}MB.` }, { status: 413 });
    }

    // IMPORTANT:
    // Verify the user from the token to get userId (auth.uid equivalent)
    const sb = supabaseAdmin();
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Ensure there is a submission row for this (eventId + userId)
    // If your redeem flow already creates it, this is just a safety net.
    const { data: subRow, error: subErr } = await sb
      .from("submissions")
      .select("id, video_path, published")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (subErr) {
      return NextResponse.json({ error: "Failed to load submission", details: subErr }, { status: 500 });
    }
    if (!subRow?.id) {
      return NextResponse.json(
        { error: "No submission found for this user/event. Redeem a code first." },
        { status: 400 }
      );
    }

    // Build a stable storage path
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const timestamp = Date.now();
    const path = `${eventId}/${userId}/${timestamp}-${safeName}`;

    // Upload to Supabase Storage bucket "videos"
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await sb.storage
      .from("videos")
      .upload(path, bytes, {
        contentType: file.type || (ext === "mp4" ? "video/mp4" : "video/quicktime"),
        upsert: true,
      });

    if (upErr) {
      return NextResponse.json({ error: "Upload failed", details: upErr }, { status: 500 });
    }

    // Save video_path and publish immediately
    const { error: updErr } = await sb
      .from("submissions")
      .update({ video_path: path, published: true })
      .eq("id", subRow.id);

    if (updErr) {
      return NextResponse.json({ error: "Failed to update submission", details: updErr }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", details: e?.message ?? String(e) }, { status: 500 });
  }
}
