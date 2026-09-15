-- 20260841_org_domains_verified.sql
--
-- Partner self-serve white-label activation (docs/WHITE_LABEL_PLAN.md, slice 4).
-- `org_domains` maps a host to an org; a partner now attaches their own portal host
-- (kind='admin') from /partners/dashboard and we verify it against Vercel. The timestamp
-- records OUR check, not DNS state: middleware honours the row whenever a request arrives
-- on that host (if DNS is not pointed at us, no request ever does).
alter table public.org_domains
  add column if not exists verified_at timestamptz;

-- The public view is what resolveOrg() and middleware read (anon). Adding a column at the
-- end keeps every existing select working.
create or replace view public.org_domains_public as
  select org_id, host, kind, verified_at from public.org_domains;

grant select on public.org_domains_public to anon, authenticated, service_role;
