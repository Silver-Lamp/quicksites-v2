-- 20260854_publish_grace.sql
--
-- PUBLISH FIRST, CONFIRM WITHIN A WEEK.
--
-- A guest who has set an email + password can publish immediately instead of being sent to an
-- inbox at the exact moment of peak intent. The site goes live with a deadline: confirm the
-- address within the grace window or it is unpublished automatically.
--
-- ⚠️ THE DEADLINE IS THE WHOLE SAFETY ARGUMENT, so it has to be a row somebody can query — not an
-- intention. An unverified publish with no expiry is just an open door; this bounds it to days and
-- makes "who is on the clock" a `select`.
--
-- ⚠️ A SEPARATE TABLE, NOT A COLUMN ON `templates`. Direct UPDATEs to templates are blocked by
-- `app.guard_templates_update` ("Use app.commit_template()"), so a grace column would drag every
-- writer through the guard or the bypass for what is really scheduling state, not content.

create table if not exists public.publish_grace (
  template_id uuid primary key,
  -- The anonymous user who published. Recorded so the cron can re-check whether THEY verified,
  -- rather than trusting the row: someone may confirm on another device and the row not know.
  owner_id    uuid not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  -- Null while the clock is running. Set when it stops, either way.
  resolved_at timestamptz,
  -- 'verified' (they confirmed — kept live) | 'expired' (unpublished) | 'manual' (an operator)
  resolution  text
);

create index if not exists publish_grace_due_idx
  on public.publish_grace (expires_at)
  where resolved_at is null;

-- Service-role only: written by the publish route, read by the cron. No policy, RLS on.
alter table public.publish_grace enable row level security;

comment on table public.publish_grace is
  'Sites published by an unverified guest, and when they lapse. Service-role only.';

-- ─────────────────────────────────────────────────────────────────────────────
-- The inverse of public.publish_template.
--
-- ⚠️ IT SETS BOTH HALVES, BECAUSE THE EXISTING UNPUBLISH ROUTE SETS ONLY ONE and they have already
-- drifted. `/api/admin/sites/unpublish` edits `published_sites` and never touches
-- `templates.published`; checked 2026-09-26, three templates were serving publicly with
-- `published = false` and one was flagged published with no snapshot row at all. The renderer
-- serves `published_sites`; the showcase, site-routing, countBillableSites and the SEO coach read
-- `templates.published`. Half an unpublish leaves a site live that we believe is down — the worst
-- of the two directions, and exactly what an expiry sweep must never do.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.unpublish_template(
  p_template_id uuid,
  p_actor       uuid default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.templates where id = p_template_id) then
    raise exception 'template % not found', p_template_id;
  end if;

  -- Soft: keep the row (history, and the domain mapping) but make it serve nothing.
  update public.published_sites
     set status       = 'unpublished',
         is_public    = false,
         published_at = null
   where template_id = p_template_id;

  perform set_config('app.bypass_template_guard', 'on', true); -- local to this txn only
  update public.templates
     set published = false,
         published_by = coalesce(p_actor, published_by)
   where id = p_template_id;

  return true;
end
$$;

comment on function public.unpublish_template(uuid, uuid) is
  'Sanctioned unpublish: flips published_sites AND templates.published together, inside the guard bypass. The route cannot do the second with a plain UPDATE.';

revoke all on function public.unpublish_template(uuid, uuid) from public, anon, authenticated;
grant execute on function public.unpublish_template(uuid, uuid) to service_role;
