import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })

    const { code } = (await req.json()) as { code?: string }
    const trimmed = ((code ?? '')).trim().toUpperCase()
    if (trimmed.length < 4) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

    const sb = supabaseAdmin()

    // resolve user from anon session token
    const { data: userData, error: userErr } = await sb.auth.getUser(token)
    if (userErr || !userData.user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    const userId = userData.user.id

    const nowISO = new Date().toISOString()

    // Find event currently open for submissions
    const { data: openEvent, error: evErr } = await sb
      .from('events')
      .select('id')
      .lte('submissions_open_at', nowISO)
      .gt('submissions_close_at', nowISO)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (evErr) throw evErr
    if (!openEvent?.id) return NextResponse.json({ error: 'Submissions are closed' }, { status: 400 })
    const eventId = openEvent.id as string

    // If user already has a submission for this event => ok (idempotent)
    const { data: existing, error: existErr } = await sb
      .from('submissions')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existErr) throw existErr
    if (existing?.id) return NextResponse.json({ ok: true, eventId })

    // Load invite code row
    const { data: invite, error: invErr } = await sb
      .from('invite_codes')
      .select('code, event_id, used_by, used_at')
      .eq('code', trimmed)
      .eq('event_id', eventId)
      .maybeSingle()

    if (invErr) throw invErr
    if (!invite) return NextResponse.json({ error: 'Code ungültig' }, { status: 400 })

    // If already used by someone else -> reject
    if (invite.used_by && invite.used_by !== userId) {
      return NextResponse.json({ error: 'Code bereits benutzt' }, { status: 400 })
    }

    // Mark used (idempotent: if already used by same user it's fine)
    const { error: updErr } = await sb
      .from('invite_codes')
      .update({ used_by: userId, used_at: invite.used_at ?? nowISO })
      .eq('code', trimmed)
      .eq('event_id', eventId)

    if (updErr) throw updErr

    // Create submission
    const { error: subErr } = await sb.from('submissions').insert({
      event_id: eventId,
      user_id: userId,
      display_name: 'Unnamed Act',
      published: false,
    })
    if (subErr) throw subErr

    return NextResponse.json({ ok: true, eventId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
