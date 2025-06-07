create table if not exists public.early_access_codes (
  code text primary key,
  used boolean default false,
  claimed_by text,
  used_at timestamp with time zone
);
