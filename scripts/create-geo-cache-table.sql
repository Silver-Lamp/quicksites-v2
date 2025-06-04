create table if not exists geo_cache (
  id uuid primary key default uuid_generate_v4(),
  city text,
  state text,
  lat numeric,
  lon numeric,
  created_at timestamptz default now(),
  unique(city, state)
);
