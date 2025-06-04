-- Create user_profiles to store extended metadata
create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz default now(),
  last_seen_ip text,
  last_seen_agent text,
  avatar_url text
);

-- Update trigger to refresh last seen
create or replace function update_last_seen()
returns trigger as $$
begin
  update user_profiles
  set
    last_seen_at = now(),
    last_seen_ip = current_setting('request.ip', true),
    last_seen_agent = current_setting('request.user_agent', true)
  where user_id = new.user_id;
  return new;
end;
$$ language plpgsql;

-- Optional trigger example (call manually from app)
-- create trigger trg_update_seen after insert on dashboard_access_log
-- for each row execute procedure update_last_seen();
