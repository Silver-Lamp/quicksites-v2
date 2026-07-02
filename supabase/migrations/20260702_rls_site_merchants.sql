-- SECURITY: lock site_merchants (RLS-disabled → anon-writable via PostgREST).
--
-- public/merchants lists the APPROVED merchants for a site by reading
-- site_merchants(status='approved'). Because the table was RLS-disabled with
-- anon/authenticated write grants, anyone with the public anon key could PLANT an
-- approved row — injecting their merchant onto ANY site's directory (and bypassing
-- any approval workflow). No app code writes this table via a user/browser client
-- (verified), and public/merchants reads it with the SERVICE-ROLE client (bypasses
-- RLS), so RLS deny-default blocks the injection with no app change.
alter table public.site_merchants enable row level security;
