-- Run this in Supabase → SQL Editor for cloud sync between phone and PC.

create table if not exists recipe_library (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  -- Optimistic-concurrency counter. Every save checks `version = <what it
  -- last read>` before writing, and bumps it by 1. If another device saved
  -- in between, the check matches zero rows and that write is rejected
  -- instead of silently overwriting the newer data.
  -- Existing database? Run this once in the SQL Editor:
  --   alter table recipe_library add column if not exists version integer not null default 1;
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table recipe_library enable row level security;

create policy "Users read own recipes"
  on recipe_library for select
  using (auth.uid() = user_id);

create policy "Users write own recipes"
  on recipe_library for insert
  with check (auth.uid() = user_id);

create policy "Users update own recipes"
  on recipe_library for update
  using (auth.uid() = user_id);

-- Realtime (enable in Supabase Dashboard → Database → Replication for recipe_library)
