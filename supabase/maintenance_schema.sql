-- Run this in Supabase → SQL Editor. Same shape as recipe_library:
-- one JSON blob per user, guarded by an optimistic-concurrency version.

create table if not exists maintenance_library (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{"items": []}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table maintenance_library enable row level security;

create policy "Users read own maintenance data"
  on maintenance_library for select
  using (auth.uid() = user_id);

create policy "Users insert own maintenance data"
  on maintenance_library for insert
  with check (auth.uid() = user_id);

create policy "Users update own maintenance data"
  on maintenance_library for update
  using (auth.uid() = user_id);

-- Realtime (enable in Supabase Dashboard → Database → Replication for maintenance_library)
