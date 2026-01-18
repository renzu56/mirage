import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'videos' // <-- change if your bucket name differs

function extFrom(filename: string, contentType?: string | null) {
  const lower = (filename || '').toLowerCase().trim()

  if (contentType === 'video/mp4') return 'mp4'
  if (contentType === 'video/quicktime') return 'mov'

  if (lower.endsWith('.mp4')) return 'mp4'
  if (lower.endsWith('.mov')) return 'mov'

  // fallback: iOS sometimes sends empty type
  return 'mp4'
}

function contentTypeFrom(ext: string) {
  if (ext === 'mov') return 'video/quicktime'
  return 'video/mp4'
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing Supabase env vars' },
        { status: 500 }
      )
    }

    const auth = req.headers.get('authorization') || ''
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!jwt) {
      return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as
      | { eventId?: string; filename?: string; contentType?: string }
      | null

    const eventId = body?.eventId
    const filename = body?.filename || 'upload.mp4'
    const incomingType = body?.contentType || null

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const ext = extFrom(filename, incomingType)
    const finalContentType = contentTypeFrom(ext)

    // Validate file type (allow mp4 + mov)
    if (finalContentType !== 'video/mp4' && finalContentType !== 'video/quicktime') {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload MP4 or MOV.' },
        { status: 415 }
      )
    }

    const sbAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Verify user via JWT
    const { data: userData, error: userErr } = await sbAdmin.auth.getUser(jwt)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = userData.user.id
    const rand = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    const path = `${eventId}/${userId}/${rand}.${ext}`

    // Create signed upload token (client will upload directly to Storage)
    const { data, error } = await sbAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create signed upload URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      bucket: BUCKET,
      path,
      token: data.token,
      signedUrl: data.signedUrl, // optional, useful for debugging
      contentType: finalContentType,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Upload init failed' },
      { status: 500 }
    )
  }
}
