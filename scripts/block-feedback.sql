create table if not exists public.block_feedback (
  id uuid primary key default gen_random_uuid(),
  block_id uuid references blocks on delete cascade,
  user_id uuid references auth.users,
  action text check (action in ('cheer', 'echo', 'reflect')),
  message text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_block_feedback_block on public.block_feedback (block_id);
