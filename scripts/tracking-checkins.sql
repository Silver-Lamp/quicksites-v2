create table if not exists public.tracking_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  block_id uuid references blocks on delete cascade,
  slug text not null, -- habit or tracker identifier (e.g., "floss")
  checked_at timestamp with time zone default now()
);

create index if not exists idx_tracking_slug_user on public.tracking_checkins (slug, user_id);
create index if not exists idx_tracking_checked_at on public.tracking_checkins (checked_at);
