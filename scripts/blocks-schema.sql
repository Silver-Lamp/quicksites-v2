create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  slug text unique not null,
  title text,
  message text,
  lat double precision,
  lon double precision,
  room text, -- optional: e.g., "bathroom", "kitchen"
  emoji text,
  image_url text,
  actions jsonb, -- e.g. [{ "label": "Check In", "type": "checkin", "target": "habit_id" }]
  visibility text default 'public', -- 'public', 'private', or 'shared'
  created_at timestamp with time zone default now()
);

create table if not exists public.block_checkins (
  id uuid primary key default gen_random_uuid(),
  block_id uuid references blocks on delete cascade,
  user_id uuid references auth.users,
  checked_at timestamp with time zone default now()
);
