import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client.
 *
 * IMPORTANT: only use publishable/anon keys here.
 * Supported env vars:
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy anon JWT)
 * - NEXT_PUBLIC_SUPABASE_KEY (if you prefer that naming)
 */
let _client: SupabaseClient | null = null

export const supabaseBrowser = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY

  if (!url || !publishable) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or a publishable key (NEXT_PUBLIC_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_KEY)')
  }

  if (_client) return _client

  _client = createClient(url, publishable, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })

  return _client
}
