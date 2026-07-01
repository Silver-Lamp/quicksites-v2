-- White-label follow-ups (docs/WHITE_LABEL_PLAN.md):
--   (a) per-org email sender  — add organizations.email_from
--   (b) theme_json accents    — expose organizations.theme_json on the public view
--
-- organizations_public is a read-only view over organizations (RLS-safe subset)
-- consumed by lib/org/resolveOrg.ts via the anon client. It currently omits
-- theme_json (so Org.theme_json was always empty) and has no email_from. Both are
-- additive and safe to expose publicly (theme colors + a sender display address).
-- Idempotent; applied to the live DB (organizations_public lives only in the DB,
-- like the commerce tables — see CLAUDE.md §8).

alter table public.organizations
  add column if not exists email_from text;

-- Recreate the view with all existing columns + theme_json + email_from appended.
-- (CREATE OR REPLACE VIEW only allows adding columns at the end, which is what we do.)
create or replace view public.organizations_public as
  select
    id,
    slug,
    name,
    logo_url,
    dark_logo_url,
    favicon_url,
    support_email,
    support_url,
    billing_mode,
    branding,
    primary_domain,
    wildcard_enabled,
    canonical_host,
    theme_json,
    email_from
  from public.organizations;
