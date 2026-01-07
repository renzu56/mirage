# AeroStage (MVP)

Swipe-only TikTok-style music video feed, but in weekly “events” (≈300 musicians). No comments. Likes are counted via **IP-hash** (server-side), one like per IP per video.

## 1) Supabase Setup

1. Create a new Supabase project.
2. In **Auth → Providers**, enable **Anonymous Sign-ins**.
3. In **SQL Editor**, run:
   - `supabase/schema.sql`
4. Create a **Storage Bucket** named **`videos`** and set it **Private**.
5. In **Storage → Policies**, add the SQL policies at the bottom of `schema.sql` (uncomment and run).
6. (Optional) Seed an example event & 300 codes:
   - run `supabase/seed.sql` and then execute `generate_invite_codes(..., 300)`.

### Event model (important)
- `submissions_open_at`..`submissions_close_at`: when musicians can redeem codes & upload.
- `starts_at`..`ends_at`: when the feed is live.

## 2) Configure env vars

Copy `.env.example` to `.env.local` and fill:

**Public (browser):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy anon JWT) **or** `NEXT_PUBLIC_SUPABASE_KEY`

**Server-only (never expose to browser):**
- `SUPABASE_SECRET_KEY` (new Supabase secret key, often starts with `sb_secret_...`) **or** `SUPABASE_SERVICE_ROLE_KEY` (legacy)
- `LIKE_SALT` (random string; used to hash IPs for like tracking)

## 3) Run locally

```bash
npm install
npm run dev
```
Open http://localhost:3000

## 4) How it works

- `/` shows the **Frutiger-Aero** “closed” UI with countdown.
- `/submit` lets musicians:
  - auto-login anonymously
  - redeem their one-time code (POST `/api/redeem`)
  - upload a video to private bucket (`<uid>/<event_id>.mp4`)
  - set links + description
- `/event` is only accessible while the event is live.
  - Server builds a feed using the Postgres function `get_feed_for_event`.
  - Each video is delivered as a **signed URL** (private bucket, no leaks).
  - Likes go through POST `/api/like` and are stored per **IP-hash**.

## 5) Admin workflow (weekly)

1. Insert a new row in `events` with the 4 timestamps.
2. Generate codes (paste the UUID you got from `insert ... returning id`):

```sql
select public.generate_invite_codes('<PASTE_EVENT_UUID_HERE>'::uuid, 300);
```

3. Distribute codes to musicians.

## Notes / MVP tradeoffs

- IP-likes are **not** a perfect identity (NAT/VPN/shared networks), but match your spec.
- Creating 300 signed URLs per page load is okay for an MVP; if you scale, cache results or sign on-demand.
