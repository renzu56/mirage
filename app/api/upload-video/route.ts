import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // important for File/Buffer handling on Netlify

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey)
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY / SUPABASE_KEY)"
    );

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function pickExt(file: File) {
  // iOS sometimes sends video/quicktime for .mov
  const t = (file.type || "").toLowerCase();
  if (t.includes("quicktime")) return "mov";
  if (t.includes("mp4")) return "mp4";

  // fallback: sniff name if present
  const anyFile = file as any;
  const name = String(anyFile?.name || "").toLowerCase();
  if (name.endsWith(".mov")) return "mov";
  if (name.endsWith(".mp4")) return "mp4";

  // default
  return "mp4";
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization Bearer token" },
        { status: 401 }
      );
    }

    const sb = getAdmin();

    // Validate Supabase user from token
    const { data: userRes, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json(
        { error: "Invalid auth token", details: userErr?.message ?? null },
        { status: 401 }
      );
    }
    const userId = userRes.user.id;

    // Parse multipart form
    const form = await req.formData();
    const file = form.get("file");
    const eventId = String(form.get("eventId") || "").trim();

    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // Accept mp4 + mov (+ other video types if you want)
    const ext = pickExt(file);
    const mime = (file.type || "").toLowerCase();
    const isOk =
      ext === "mp4" ||
      ext === "mov" ||
      mime.startsWith("video/") ||
      mime === "";

    if (!isOk) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "unknown"}` },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Storage path
    const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const path = `${eventId}/${userId}/${filename}`;

    // Upload to Supabase Storage (bucket: videos)
    const { error: upErr } = await sb.storage.from("videos").upload(path, bytes, {
      contentType: file.type || (ext === "mov" ? "video/quicktime" : "video/mp4"),
      upsert: true,
      cacheControl: "31536000",
    });

    if (upErr) {
      return NextResponse.json(
        { error: "Storage upload failed", details: upErr.message },
        { status: 500 }
      );
    }

    // IMPORTANT: update the submission row server-side (so video_path ALWAYS saves)
    // Requires that user already redeemed a code (row exists).
    const { data: updated, error: updErr } = await sb
      .from("submissions")
      .update({
        video_path: path,
        published: true, // auto-publish on upload (change to false if you prefer manual publish)
      })
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .select(
        "id,event_id,user_id,display_name,description,spotify_url,soundcloud_url,instagram_url,video_path,published"
      )
      .maybeSingle();

    if (updErr) {
      return NextResponse.json(
        { error: "DB update failed", details: updErr.message },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "No submission row found. Redeem a code first (so submissions row exists).",
          path,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, path, submission: updated });
  } catch (e: any) {
    console.error("UPLOAD ERROR:", e);
    return NextResponse.json(
      { error: "Upload crashed", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
