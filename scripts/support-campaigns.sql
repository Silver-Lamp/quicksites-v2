create table if not exists public.support_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  headline text,
  goal_count integer,
  target_action text, -- 'cheer', 'echo', 'reflect', or 'checkin'
  block_id uuid,
  created_by uuid references auth.users,
  created_at timestamp with time zone default now()
);
