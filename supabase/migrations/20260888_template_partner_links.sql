-- Owner-consented link between a QS booking site and a partner's restaurant record
-- (HiveJournal's floor plan + food cost; crosstalk 2026-10-15, contracts/restaurant-floor-plan.md).
-- Before this, a valid partner signature could read ANY template's bookings; now the four partner
-- booking routes answer only for a template whose OWNER minted a one-time code on QS and whose
-- partner verified it — the demo trattoria excepted by its demo flags. A link is unlinked, never
-- deleted, so "when was this site shared and by whom" always has an answer.
create table if not exists public.template_partner_links (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  partner text not null check (partner in ('hivejournal')),
  status text not null default 'pending' check (status in ('pending','linked','unlinked')),
  code_hash text,
  code_expires_at timestamptz,
  code_used_at timestamptz,
  linked_by uuid,
  linked_at timestamptz,
  partner_ref text,
  unlinked_at timestamptz,
  unlinked_by text check (unlinked_by is null or unlinked_by in ('owner','partner')),
  unlink_reason text,
  created_at timestamptz not null default now()
);
create index if not exists template_partner_links_template_idx on public.template_partner_links (template_id, partner, status);
-- One LIVE link per (template, partner); history rows carry other statuses.
create unique index if not exists template_partner_links_one_linked on public.template_partner_links (template_id, partner) where status = 'linked';

-- Deny-default: service role only.
alter table public.template_partner_links enable row level security;
