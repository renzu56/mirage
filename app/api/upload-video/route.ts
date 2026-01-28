import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// If you deploy on Vercel and hit timeouts, you can increase this:
// export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configure via env if you want:
// - SUPABASE_VIDEO_BUCKET=submission-videos
// - MAX_VIDEO_MB=200
const VIDEO_BUCKET = process.env.SUPABASE_VIDEO_BUCKET || "submission-videos";
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB || "200");

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY", 500);
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError("Missing SUPABASE_SERVICE_ROLE_KEY on the server", 500);
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Missing Bearer token", 401);

    // Client for validating the JWT
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await sbAuth.auth.getUser(token);
    if (userErr || !userData?.user) return jsonError("Invalid token", 401);

    const user = userData.user;

    const form = await req.formData();

    const eventId = String(form.get("eventId") || "").trim();
    const file = form.get("file");

    if (!eventId) return jsonError("Missing eventId", 400);
    if (!(file instanceof File)) return jsonError("Missing file", 400);

    // Validate video type: mp4 or mov
    const allowedTypes = new Set(["video/mp4", "video/quicktime"]);
    if (!allowedTypes.has(file.type)) {
      return jsonError(`Unsupported file type: ${file.type}. Please upload .mp4 or .mov`, 400);
    }

    const maxBytes = MAX_VIDEO_MB * 1024 * 1024;
    if (Number.isFinite(maxBytes) && file.size > maxBytes) {
      return jsonError(
        `File too large: ${Math.round(file.size / 1024 / 1024)}MB (limit ${MAX_VIDEO_MB}MB)`,
        413
      );
    }

    // Service role client for Storage + DB write
    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ext = file.type === "video/mp4" ? "mp4" : "mov";
    const path = `${eventId}/${user.id}/${crypto.randomUUID()}.${ext}`;

    const bytes = await file.arrayBuffer();

    const { error: uploadErr } = await sbAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(path, bytes, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error("STORAGE UPLOAD ERROR:", uploadErr);
      return jsonError(`Storage upload failed: ${uploadErr.message}`, 500);
    }

    // Text fields
    const display_name = String(form.get("display_name") || "").trim() || "Unnamed act";
    const description = String(form.get("description") || "").trim() || null;

    const spotify_url = String(form.get("spotify_url") || "").trim() || null;
    const soundcloud_url = String(form.get("soundcloud_url") || "").trim() || null;
    const instagram_url = String(form.get("instagram_url") || "").trim() || null;

    // Update the user's submission for this event
    const { data: submission, error: dbErr } = await sbAdmin
      .from("submissions")
      .update({
        display_name,
        description,
        spotify_url,
        soundcloud_url,
        instagram_url,
        video_path: path,
        published: true,
      })
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .select(
        "id,event_id,user_id,display_name,description,spotify_url,soundcloud_url,instagram_url,video_path,published"
      )
      .maybeSingle();

    if (dbErr) {
      console.error("DB UPDATE ERROR:", dbErr);
      return jsonError(`DB update failed: ${dbErr.message}`, 500);
    }

    if (!submission) {
      // This typically means the redeem/slot row doesn't exist for this user+event
      return jsonError("No submission row found for this user/event. Redeem a code first.", 400);
    }

    return NextResponse.json({ submission });
  } catch (e: any) {
    console.error("upload-video exception:", e);
    return jsonError(e?.message ?? "Server error", 500);
  }
}
