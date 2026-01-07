import { supabaseAdmin } from '@/lib/supabase/admin'
import type { FeedItem } from '@/lib/types'

type RawFeedRow = {
  submission_id: string
  display_name: string
  description: string | null
  spotify_url: string | null
  soundcloud_url: string | null
  instagram_url: string | null
  video_path: string
  like_count: number
}

async function signUrl(path: string) {
  const sb = supabaseAdmin()
  const { data, error } = await sb.storage.from('videos').createSignedUrl(path, 60 * 60 * 24)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function getFeedForEvent(eventId: string): Promise<FeedItem[]> {
  const sb = supabaseAdmin()

  // Server-side SQL function: get_feed_for_event
  const { data, error } = await sb.rpc('get_feed_for_event', { p_event_id: eventId })
  if (error) throw error

  const rows = (data ?? []) as RawFeedRow[]
  const signed = await Promise.all(rows.map((r) => signUrl(r.video_path)))

  const out: FeedItem[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const video_url = signed[i]
    if (!video_url) continue
    out.push({
      submission_id: r.submission_id,
      display_name: r.display_name,
      description: r.description,
      spotify_url: r.spotify_url,
      soundcloud_url: r.soundcloud_url,
      instagram_url: r.instagram_url,
      video_url,
      like_count: Number(r.like_count ?? 0),
    })
  }

  return out
}
