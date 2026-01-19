import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json(401, { error: "Missing Bearer token" });

    const sb = supabaseAdmin();

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(401, { error: "Invalid token" });
    }
    const userId = userData.user.id;

    const form = await req.formData();
    const file = form.get("file");
    const eventId = String(form.get("eventId") || "").trim();

    if (!eventId) return json(400, { error: "Missing eventId" });
    if (!file || !(file instanceof File)) return json(400, { error: "Missing file" });

    // Accept mp4 + mov (quicktime). Note: playback depends on codecs.
    const contentType = file.type || "application/octet-stream";
    const allowed = [
      "video/mp4",
      "video/quicktime", // .mov
      "video/x-m4v",
    ];
    if (!allowed.includes(contentType) && !contentType.startsWith("video/")) {
      return json(400, { error: `Unsupported file type: ${contentType}` });
    }

    const maxBytes = 50 * 1024 * 1024; // 50MB
    if (file.size > maxBytes) return json(400, { error: "File too large (max 50MB)" });

    const originalName = (file.name || "upload").toLowerCase();
    const ext =
      originalName.endsWith(".mov") ? "mov" :
      originalName.endsWith(".m4v") ? "m4v" :
      "mp4";

    const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `${eventId}/${userId}/${filename}`;

    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await sb.storage
      .from("videos")
      .upload(path, bytes, {
        contentType,
        upsert: true,
        cacheControl: "3600",
      });

    if (upErr) {
      return json(500, { error: upErr.message });
    }

    return json(200, { path });
  } catch (e: any) {
    return json(500, { error: e?.message ?? "Upload failed" });
  }
}
