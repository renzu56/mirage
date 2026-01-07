-- Example: create a weekly event and 300 codes
-- Adjust timestamps to your schedule (timestamptz).

insert into public.events (title, starts_at, ends_at, submissions_open_at, submissions_close_at)
values (
  'Week #1',
  '2026-01-02 20:00:00+01',
  '2026-01-03 20:00:00+01',
  '2025-12-27 12:00:00+01',
  '2026-01-02 18:00:00+01'
)
returning id;

-- Replace <EVENT_ID> with the returned id
-- select public.generate_invite_codes('<EVENT_ID>'::uuid, 300);

-- See codes (admin only)
-- select * from public.invite_codes where event_id = '<EVENT_ID>' order by created_at desc;
