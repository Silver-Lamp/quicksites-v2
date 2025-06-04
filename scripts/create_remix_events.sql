create table if not exists remix_events (
  id uuid primary key default gen_random_uuid(),
  original_snapshot_id uuid,
  user_id uuid,
  created_at timestamp with time zone default timezone('utc', now())
);
