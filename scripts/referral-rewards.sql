create table if not exists referrals (
  id uuid default gen_random_uuid() primary key,
  referrer_id uuid not null,
  referred_email text,
  reward_points int default 0,
  created_at timestamptz default now()
);

create table if not exists steward_rewards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  site_domain text,
  reason text,
  points int default 1,
  created_at timestamptz default now()
);
