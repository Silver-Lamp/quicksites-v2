-- Persist each template's SEO-readiness score so the templates/sites list can sort
-- by it with a plain ORDER BY (no in-memory cap). The score is computed in Node
-- (lib/outreach/readiness.ts — the same checklist the in-editor coach uses) and
-- written here on commit/publish + a one-off backfill.
--
-- `seo_readiness_pct` (0–100) is the sortable/indexed column; `seo_readiness` keeps
-- the { pct, done, total, hardLeft } detail for the card/table tooltip.
--
-- Writes go through set_template_seo() because direct UPDATEs to templates are
-- blocked by app.guard_templates_update — this SECURITY DEFINER fn flips the same
-- txn-local bypass GUC the claim/commit paths use, and touches ONLY the two score
-- columns (there is no updated_at trigger, so scoring never reorders the recency
-- view). Idempotent. Pending — run `npm run db:migrate:up`.

alter table public.templates add column if not exists seo_readiness_pct smallint;
alter table public.templates add column if not exists seo_readiness jsonb;

create index if not exists templates_seo_readiness_pct_idx
  on public.templates (seo_readiness_pct);

create or replace function public.set_template_seo(p_id uuid, p_pct int, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id is null then return; end if;
  perform set_config('app.bypass_template_guard', 'on', true); -- txn-local
  update public.templates
     set seo_readiness_pct = p_pct,
         seo_readiness = p_detail
   where id = p_id;
end;
$$;

revoke all on function public.set_template_seo(uuid, int, jsonb) from public;
revoke all on function public.set_template_seo(uuid, int, jsonb) from anon;
revoke all on function public.set_template_seo(uuid, int, jsonb) from authenticated;
grant execute on function public.set_template_seo(uuid, int, jsonb) to service_role;
