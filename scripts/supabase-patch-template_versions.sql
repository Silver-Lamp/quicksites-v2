-- Patch: Add missing columns to match save bar integration
alter table template_versions
add column if not exists template_id uuid references templates(id),
add column if not exists created_at timestamptz default now();
