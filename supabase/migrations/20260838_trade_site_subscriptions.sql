-- 20260838_trade_site_subscriptions.sql
--
-- The money step for auto-built trade sites (docs/TRADE_SITES_PIPELINE.md).
--
-- A trade business claims the site we built from its listing for free; the paid tier is a custom
-- domain we register and manage, sold self-serve on the post-claim page. Until this table existed
-- "there is no checkout for these tiers" was literally true (lib/business/verticals.ts) — the
-- price was a proposal nobody had been asked for. One row per template: a site has at most one
-- subscription, and a second attempt updates the first rather than minting a duplicate.
--
-- Deny-default RLS: written only by the Stripe webhook and the owner-gated checkout route, both
-- service-role. The owner sees their own row through the welcome page (server-rendered).

create table if not exists public.trade_site_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  template_id             uuid not null references public.templates(id) on delete cascade,
  owner_id                uuid,
  tier                    text not null default 'custom_domain'
                            check (tier in ('custom_domain')),
  -- The domain the owner asked for at checkout. Provisioning is a separate, retryable step.
  desired_domain          text,
  domain_status           text not null default 'pending'
                            check (domain_status in ('pending','purchased','bound','manual','failed')),
  domain_detail           text,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  subscription_status     text not null default 'checkout_created',
  renter_email            text,
  -- ⚠️ payment_count is THE proof of a rental (memory: geo-rental-payment-rail). A status of
  -- 'active' says a subscription exists; only invoice.paid says money moved, and only a count
  -- distinguishes "paid once" from "still paying".
  payment_count           int not null default 0,
  last_paid_at            timestamptz,
  last_payment_cents      int,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists trade_site_subscriptions_template_uniq
  on public.trade_site_subscriptions (template_id);
create index if not exists trade_site_subscriptions_stripe_sub_idx
  on public.trade_site_subscriptions (stripe_subscription_id);

alter table public.trade_site_subscriptions enable row level security;
-- No policies on purpose: service-role only.

-- A claimed prospect was never recorded as claimed: `ProspectStatus` declared 'claimed' and no
-- code path wrote it, so a claimed trade prospect stayed 'draft_built' forever and the claim
-- rate — the decisive number for this vertical — could not be measured.
alter table public.outreach_prospects add column if not exists claimed_at timestamptz;

-- Direct UPDATEs to templates are blocked by app.guard_templates_update (CLAUDE.md §8). Binding a
-- purchased domain needs a sanctioned path; this mirrors app.set_template_slug's shape.
create or replace function public.set_template_custom_domain(
  p_template_id uuid,
  p_domain      text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_template_id is null then return false; end if;
  perform set_config('app.bypass_template_guard', 'on', true); -- txn-local
  update public.templates
     set custom_domain = nullif(lower(trim(p_domain)), '')
   where id = p_template_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.set_template_custom_domain(uuid, text) from public;
grant execute on function public.set_template_custom_domain(uuid, text) to service_role;
