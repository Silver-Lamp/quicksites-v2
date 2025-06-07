-- Enable RLS
alter table screenshot_queue enable row level security;

-- Only allow insert from service role
create policy "Allow insert for service role only"
on screenshot_queue
for insert
using (
  auth.role() = 'service_role'
);

-- Allow select for authenticated users (optional)
create policy "Allow read for authenticated"
on screenshot_queue
for select
using (auth.role() = 'authenticated');
