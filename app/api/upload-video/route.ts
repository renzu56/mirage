import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeText(v: FormDataEntryValue | null) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function pickExt(file: File) {
  const t = (file.type || "").toLowerCase();
  if (t.includes("quicktime")) return "mov";
  if (t.includes("mp4")) return "mp4";

  const anyFile = file as any;
  const name = String(anyFile?.name || "").toLowerCase();
  if (name.endsWith(".mov")) return "mov";
  if (name.endsWith(".mp4")) return "mp4";

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

    // Validate the user from the token
    const { data: userRes, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json(
        { error: "Invalid auth token", details: userErr?.message ?? null },
        { status: 401 }
      );
    }
    const userId = userRes.user.id;

    const form = await req.formData();

    const eventId = String(form.get("eventId") || "").trim();
    const file = form.get("file");

    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // Fields to persist
    const display_name = normalizeText(form.get("display_name"));
    const description = normalizeText(form.get("description"));
    const spotify_url = normalizeText(form.get("spotify_url"));
    const soundcloud_url = normalizeText(form.get("soundcloud_url"));
    const instagram_url = normalizeText(form.get("instagram_url"));

    // Upload file -> Storage
    const ext = pickExt(file);
    const bytes = Buffer.from(await file.arrayBuffer());

    const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const path = `${eventId}/${userId}/${filename}`;

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

    // Update submission row server-side (guaranteed write)
    const { data: updated, error: updErr } = await sb
      .from("submissions")
      .update({
        display_name: display_name ?? "Unnamed act",
        description,
        spotify_url,
        soundcloud_url,
        instagram_url,
        video_path: path,
        published: true,
      })
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .select(
        "id,event_id,user_id,display_name,description,spotify_url,soundcloud_url,instagram_url,video_path,published"
      )
      .maybeSingle();

    if (updErr) {
      return NextResponse.json(
        { error: "DB update failed", details: updErr.message, path },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "No submission row found for this user/event. Redeem a code first so the submission row exists.",
          path,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, path, submission: updated });
  } catch (e: any) {
    console.error("PUBLISH ERROR:", e);
    return NextResponse.json(
      { error: "Publish crashed", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
