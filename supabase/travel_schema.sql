-- Run this in Supabase → SQL Editor. Same shape as recipe_library and
-- maintenance_library: one JSON blob per user, guarded by an
-- optimistic-concurrency version.

create table if not exists travel_library (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{"trips": []}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table travel_library enable row level security;

create policy "Users read own travel data"
  on travel_library for select
  using (auth.uid() = user_id);

create policy "Users insert own travel data"
  on travel_library for insert
  with check (auth.uid() = user_id);

create policy "Users update own travel data"
  on travel_library for update
  using (auth.uid() = user_id);

-- Realtime (enable in Supabase Dashboard → Database → Replication for travel_library)
