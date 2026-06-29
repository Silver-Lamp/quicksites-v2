-- Global app settings (key/value). Server/service-role only.
-- Used by the homepage showcase display-mode admin control (and future global settings).
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.site_settings enable row level security;

-- No policies on purpose: all reads/writes go through admin-gated server routes
-- using the service-role key (which bypasses RLS). RLS-on + no policies denies
-- the anon/authenticated roles by default.

comment on table public.site_settings is
  'Global app settings (key/value). Service-role/server only; RLS denies anon/auth by default.';
