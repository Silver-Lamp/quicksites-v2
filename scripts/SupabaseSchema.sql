create table report_webhooks (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  event text not null,
  secret_token text,
  enabled boolean default true
);

create table report_tokens (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  token_hash text not null,
  expires_at timestamp not null
);
