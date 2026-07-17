-- Site comments / discussions — visitor-posted comments on a published site's `comments`
-- block. This is the platform's first PUBLIC user-generated-content surface, so anti-abuse
-- is structural: comments land 'pending' and never render publicly until the site owner
-- approves (approve-before-publish is the default; the block can turn it off). Content is
-- screened (lib/safety/prohibitedContent) + per-IP rate-limited at the POST route; recipient
-- for owner notification is derived server-side, never client-trusted (no open relay).
--
-- Deny-default RLS — service-role (server routes) only. The public GET route returns only
-- approved rows via the admin client; owners moderate via an owner-gated route. No browser
-- writes to this table.
create table if not exists public.site_comments (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.templates(id) on delete cascade,
  block_id     text not null,                       -- the comments block's _id (a page can have several)
  author_name  text not null,
  body         text not null,
  status       text not null default 'pending',     -- 'pending' | 'approved' | 'rejected'
  created_ip   text,                                -- for per-IP abuse review (not shown publicly)
  moderated_by uuid,                                -- owner/admin user id who approved/rejected
  moderated_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists site_comments_block_idx
  on public.site_comments (template_id, block_id, status, created_at desc);

alter table public.site_comments enable row level security;
-- Deny-default: no policies → only the service role (server) reads/writes.
revoke all on public.site_comments from anon, authenticated;
