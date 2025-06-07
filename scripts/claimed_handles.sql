create table if not exists claimed_handles (
  handle text primary key,
  user_id uuid not null,
  claimed_at timestamp with time zone default now()
);
