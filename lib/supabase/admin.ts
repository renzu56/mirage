import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client.
 *
 * Supports both legacy and new Supabase API keys:
 * - New: SUPABASE_SECRET_KEY (often starts with sb_secret_...)
 * - Legacy: SUPABASE_SERVICE_ROLE_KEY (JWT)
 * - Fallback: SUPABASE_KEY (if you named it that way)
 */
export const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  // Supabase JS expects a JWT-style API key (typically starts with "eyJ...").
  // Some Supabase dashboards also show "sb_secret_..." / "sb_publishable_..." keys.
  // Those are NOT compatible with supabase-js createClient as the "supabaseKey".
  // If you have both, prefer the JWT service role key.
  const serviceRoleJwt = process.env.SUPABASE_SERVICE_ROLE_KEY
  const secretMaybeJwt = process.env.SUPABASE_SECRET_KEY
  const legacyMaybeJwt = process.env.SUPABASE_KEY

  const isJwt = (k?: string) => !!k && k.startsWith('eyJ')

  const key =
    (isJwt(serviceRoleJwt) ? serviceRoleJwt : undefined) ||
    (isJwt(secretMaybeJwt) ? secretMaybeJwt : undefined) ||
    (isJwt(legacyMaybeJwt) ? legacyMaybeJwt : undefined) ||
    // Last resort: pick whatever is set (useful for debugging, but can 500 if incompatible)
    serviceRoleJwt ||
    secretMaybeJwt ||
    legacyMaybeJwt

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or a server key (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY)'
    )
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
