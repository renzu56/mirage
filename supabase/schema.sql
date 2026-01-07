-- AeroStage schema (run in Supabase SQL Editor)

-- Extensions
create extension if not exists pgcrypto;

-- EVENTS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  submissions_open_at timestamptz not null,
  submissions_close_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- INVITE CODES (300 per event)
create table if not exists public.invite_codes (
  code text primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  used_by uuid null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists invite_codes_event_id_idx on public.invite_codes(event_id);
create index if not exists invite_codes_used_by_idx on public.invite_codes(used_by);

-- SUBMISSIONS
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  description text null,
  spotify_url text null,
  soundcloud_url text null,
  instagram_url text null,
  video_path text null, -- storage path: <user_id>/<event_id>.mp4
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists submissions_one_per_user_per_event
  on public.submissions(event_id, user_id);

create index if not exists submissions_event_id_idx on public.submissions(event_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_submissions_updated_at on public.submissions;
create trigger trg_submissions_updated_at
before update on public.submissions
for each row execute function public.set_updated_at();

-- LIKES (IP-hash based)
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists likes_unique_ip
  on public.likes(event_id, submission_id, ip_hash);

create index if not exists likes_submission_idx on public.likes(submission_id);

-- FEED RPC (server uses service role, returns like counts + video_path)
create or replace function public.get_feed_for_event(p_event_id uuid)
returns table (
  submission_id uuid,
  display_name text,
  description text,
  spotify_url text,
  soundcloud_url text,
  instagram_url text,
  video_path text,
  like_count bigint
)
language sql
stable
security definer
as $$
  select
    s.id as submission_id,
    s.display_name,
    s.description,
    s.spotify_url,
    s.soundcloud_url,
    s.instagram_url,
    s.video_path,
    coalesce(l.cnt, 0) as like_count
  from public.submissions s
  left join (
    select submission_id, count(*) as cnt
    from public.likes
    where event_id = p_event_id
    group by submission_id
  ) l on l.submission_id = s.id
  where s.event_id = p_event_id
    and s.published = true
    and s.video_path is not null
  order by s.created_at asc;
$$;

-- Helper: generate invite codes
-- NOTE: avoids ambiguous chars; produces 8-10 chars
create or replace function public.generate_invite_codes(p_event_id uuid, p_n int)
returns int
language plpgsql
security definer
as $$
declare
  i int := 0;
  c text;
begin
  while i < p_n loop
    c := upper(replace(replace(substr(encode(gen_random_bytes(8), 'base64'), 1, 10), '+', 'A'), '/', 'B'));
    -- remove '='
    c := replace(c, '=', '');
    begin
      insert into public.invite_codes(code, event_id) values (c, p_event_id);
      i := i + 1;
    exception when unique_violation then
      -- try again
      null;
    end;
  end loop;
  return i;
end;
$$;

-- RLS
alter table public.events enable row level security;
alter table public.invite_codes enable row level security;
alter table public.submissions enable row level security;
alter table public.likes enable row level security;

-- Public can read events (for countdown)
drop policy if exists events_select_all on public.events;
create policy events_select_all on public.events
for select using (true);

-- Invite codes: no direct access for anon/auth (only service role via API)
-- (No policies)

-- Submissions: musicians can read/write only their own row
-- Read own submission
 drop policy if exists submissions_select_own on public.submissions;
create policy submissions_select_own on public.submissions
for select
to authenticated
using (auth.uid() = user_id);

-- Insert own submission (used by API w/ service role anyway)
drop policy if exists submissions_insert_own on public.submissions;
create policy submissions_insert_own on public.submissions
for insert
to authenticated
with check (auth.uid() = user_id);

-- Update own submission
 drop policy if exists submissions_update_own on public.submissions;
create policy submissions_update_own on public.submissions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Likes: locked down (only service role via API)
-- (No policies)

-- STORAGE
-- Create a private bucket named: videos
-- Then add these storage policies in Supabase (Storage > Policies) or run the SQL below.

-- Allow authenticated users to upload/update/delete ONLY in their own folder: <uid>/<event_id>.mp4
-- Bucket must exist. Uncomment after bucket creation.
--
-- drop policy if exists "videos_upload_own_folder" on storage.objects;
-- create policy "videos_upload_own_folder" on storage.objects
-- for insert to authenticated
-- with check (
--   bucket_id = 'videos'
--   and (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- drop policy if exists "videos_update_own_folder" on storage.objects;
-- create policy "videos_update_own_folder" on storage.objects
-- for update to authenticated
-- using (
--   bucket_id = 'videos'
--   and (storage.foldername(name))[1] = auth.uid()::text
-- )
-- with check (
--   bucket_id = 'videos'
--   and (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- drop policy if exists "videos_delete_own_folder" on storage.objects;
-- create policy "videos_delete_own_folder" on storage.objects
-- for delete to authenticated
-- using (
--   bucket_id = 'videos'
--   and (storage.foldername(name))[1] = auth.uid()::text
-- );
