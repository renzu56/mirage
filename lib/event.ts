import { supabaseAdmin } from '@/lib/supabase/admin'
import type { EventRow } from '@/lib/types'

export type EventStatus = {
  live: EventRow | null
  next: EventRow | null
  submissionsOpen: EventRow | null
}

export async function getEventStatus(): Promise<EventStatus> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('events')
    .select('id,title,starts_at,ends_at,submissions_open_at,submissions_close_at')
    .order('starts_at', { ascending: true })

  if (error) throw error
  const events = (data ?? []) as EventRow[]
  const now = new Date()

  const live = events.find((e) => new Date(e.starts_at) <= now && new Date(e.ends_at) > now) ?? null
  const next =
    events
      .filter((e) => new Date(e.starts_at) > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null

  const submissionsOpen =
    events.find((e) => new Date(e.submissions_open_at) <= now && new Date(e.submissions_close_at) > now) ?? null

  return { live, next, submissionsOpen }
}
