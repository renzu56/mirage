import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function getIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  const xr = req.headers.get('x-real-ip')
  if (xr) return xr.trim()
  // fallback (dev)
  return '0.0.0.0'
}

function hashIp(ip: string) {
  const salt = process.env.LIKE_SALT ?? 'dev-salt'
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { eventId, submissionId } = (await req.json()) as {
      eventId?: string
      submissionId?: string
    }
    if (!eventId || !submissionId) {
      return NextResponse.json({ error: 'Missing eventId/submissionId' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const nowISO = new Date().toISOString()

    // Event must be live
    const { data: ev, error: evErr } = await sb
      .from('events')
      .select('id')
      .eq('id', eventId)
      .lte('starts_at', nowISO)
      .gt('ends_at', nowISO)
      .maybeSingle()
    if (evErr) throw evErr
    if (!ev?.id) {
      return NextResponse.json({ error: 'Event not live' }, { status: 400 })
    }

    const ipHash = hashIp(getIp(req))

    // Toggle like: try insert, if conflict then delete
    const { error: insErr } = await sb.from('likes').insert({
      event_id: eventId,
      submission_id: submissionId,
      ip_hash: ipHash,
    })

    if (insErr) {
      const code = (insErr as any).code
      if (code !== "23505") throw insErr
      // unique violation -> unlike
      const { error: delErr } = await sb
        .from('likes')
        .delete()
        .eq('event_id', eventId)
        .eq('submission_id', submissionId)
        .eq('ip_hash', ipHash)
      if (delErr) throw delErr
    }

    const { count, error: cntErr } = await sb
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('submission_id', submissionId)

    if (cntErr) throw cntErr

    return NextResponse.json({ like_count: count ?? 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
