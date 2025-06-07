create table if not exists public.thank_you_notes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users,
  recipient_id uuid,
  block_id uuid,
  message text,
  created_at timestamp with time zone default now()
);
