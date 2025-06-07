create table if not exists public.starter_templates (
  id text primary key,
  name text,
  description text,
  template_id text,
  preview text,
  data jsonb
);
