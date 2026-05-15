-- Run this in Supabase → SQL Editor for cloud sync between phone and PC.

create table if not exists recipe_library (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
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
