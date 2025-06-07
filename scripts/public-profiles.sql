create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  handle text unique,
  bio text,
  emoji text default '🌱',
  goal_tags text[],
  visible boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_public_profiles_visible on public.public_profiles (visible);
