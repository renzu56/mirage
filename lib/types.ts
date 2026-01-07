export type EventRow = {
  id: string
  title: string
  starts_at: string // timestamptz
  ends_at: string // timestamptz
  submissions_open_at: string
  submissions_close_at: string
}

export type FeedItem = {
  submission_id: string
  display_name: string
  description: string | null
  spotify_url: string | null
  soundcloud_url: string | null
  instagram_url: string | null
  video_url: string
  like_count: number
}

export type SubmissionRow = {
  id: string
  event_id: string
  user_id: string
  display_name: string
  description: string | null
  spotify_url: string | null
  soundcloud_url: string | null
  instagram_url: string | null
  video_path: string | null
  published: boolean
}
