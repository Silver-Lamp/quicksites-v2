-- 20260859_clear_template_phone.sql
--
-- BLANK A TEMPLATE'S PHONE — the one thing `commit_template` structurally cannot do.
--
-- ⚠️ `app.commit_template` writes every scalar column as
--     phone = coalesce(NULLIF(v_patch->>'phone',''), t.phone)
-- so a patch of `null` OR `''` collapses to "keep what was there". That is deliberate and good:
-- it stops a partial patch from wiping columns it never meant to touch. The cost is that
-- REMOVING a value is not expressible through the sanctioned path at all, and a caller who tries
-- gets a 200 and no change — which is how a script came to print "cleared templates.phone" while
-- the number sat in the column (2026-09-27, releasing +1 425 270 2226 from millcreektowing.com).
--
-- This exists so that operation has a sanctioned, auditable home instead of a hand-typed
-- `set_config('app.bypass_template_guard', ...)` in somebody's psql history.
--
-- Deliberately NARROW: one column, one template, no patch object. A general "clear any field"
-- RPC would re-open exactly the accidental-wipe hole the coalesce pattern is protecting.

create or replace function public.clear_template_phone(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
begin
  perform set_config('app.bypass_template_guard', 'on', true);
  update public.templates
     set phone = null,
         rev = coalesce(rev, 0) + 1,
         updated_at = now()
   where id = p_template_id;
end;
$$;

revoke all on function public.clear_template_phone(uuid) from public, anon, authenticated;
grant execute on function public.clear_template_phone(uuid) to service_role;

comment on function public.clear_template_phone(uuid) is
  'Blank templates.phone. Needed because commit_template is set-or-keep (coalesce/NULLIF) and cannot express a removal — see 20260859.';
