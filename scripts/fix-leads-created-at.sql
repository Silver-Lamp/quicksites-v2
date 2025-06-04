alter table leads
add column if not exists created_at timestamptz default now();
