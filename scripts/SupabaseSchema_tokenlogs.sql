create table token_logs (
  id uuid primary key default gen_random_uuid(),
  token_hash text,
  file_name text,
  downloaded_at timestamp default timezone('utc', now()),
  user_agent text
);
