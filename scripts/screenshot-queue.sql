create table if not exists screenshot_queue (
  id uuid default gen_random_uuid() primary key,
  domain text not null,
  status text default 'pending', -- pending | processing | complete | failed
  requested_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_screenshot_queue_status on screenshot_queue(status);
