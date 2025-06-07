create table if not exists public.early_access_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  invite_code text,
  created_at timestamp with time zone default now()
);
