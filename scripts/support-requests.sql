create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users,
  receiver_handle text not null,
  slug text,
  message text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_support_requests_receiver on public.support_requests (receiver_handle);
