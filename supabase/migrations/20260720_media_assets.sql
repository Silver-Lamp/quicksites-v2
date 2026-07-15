-- Media-asset registry: a queryable record of every hero image a site owner
-- generates or uploads, so the editor can offer an image library / picker.
--
-- Today hero images are fire-and-forget: generated → uploaded to the `templates`
-- Storage bucket → the URL baked into the block JSON, with nothing recording that
-- the image existed. This table is that record. It's scoped by org + industry +
-- template so the picker can widen from "this site" → "same industry in my org" →
-- "all my sites" → "public" (images on published sites, derived by joining
-- templates.published at read time — not a stored flag, so it tracks publish state).
--
-- Service-role only: no RLS policies → deny-default (all client access blocked).
-- The authz'd /api/media/assets route reads/writes with the service-role key
-- (route-level authorization is load-bearing — see CLAUDE.md §6). Idempotent.
-- Pending — run `npm run db:migrate:up`.

create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid,                                    -- creating user (null-org fallback scoping)
  org_id       uuid,                                    -- from the template at record time
  template_id  uuid references public.templates(id) on delete cascade,
  industry     text,                                    -- normalized industry key at record time
  url          text not null,                           -- public URL
  storage_path text,                                    -- bucket path (for future cleanup)
  kind         text not null default 'hero',            -- 'hero' | 'logo' | 'favicon' | 'other'
  source       text not null default 'generated',       -- 'generated' | 'uploaded'
  subject      text,                                     -- image-subject / prompt
  width        integer,
  height       integer,
  created_at   timestamptz not null default now()
);

alter table public.media_assets enable row level security;

-- Idempotent de-dup: one row per URL (backfill + record both upsert on this).
create unique index if not exists media_assets_url_key on public.media_assets (url);
create index if not exists media_assets_org_industry_idx on public.media_assets (org_id, industry);
create index if not exists media_assets_owner_idx on public.media_assets (owner_id);
create index if not exists media_assets_template_idx on public.media_assets (template_id);
create index if not exists media_assets_created_at_idx on public.media_assets (created_at desc);
