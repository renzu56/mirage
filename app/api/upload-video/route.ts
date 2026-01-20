import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";

export const runtime = "nodejs";

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

    const sb = supabaseAdmin();
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const userId = userData.user.id;

    const form = await req.formData();
    const file = form.get("file");
    const eventId = String(form.get("eventId") || "");
    if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aerostage-"));
    const inPath = path.join(tmpDir, `in-${Date.now()}-${file.name}`);
    const outPath = path.join(tmpDir, `out-${Date.now()}.mp4`);

    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inPath, buf);

    // Transcode -> MP4 H.264 + AAC + faststart
    await run("ffmpeg", [
      "-y",
      "-i",
      inPath,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outPath,
    ]);

    const outBuf = await fs.readFile(outPath);

    const stamp = Date.now();
    const storagePath = `${userId}/${eventId}-${stamp}.mp4`;

    const { error: upErr } = await sb.storage.from("videos").upload(storagePath, outBuf, {
      contentType: "video/mp4",
      upsert: true,
      cacheControl: "3600",
    });
    if (upErr) throw upErr;

    // cleanup best-effort
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({ path: storagePath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: 500 });
  }
}
