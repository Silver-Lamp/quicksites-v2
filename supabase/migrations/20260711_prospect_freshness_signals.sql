-- Store the specific "why it's dated" signals from the freshness scorer on each prospect
-- (e.g. "No mobile viewport", "Copyright stuck at 2009"), so the sales pitch is concrete.
-- Additive; safe on the already-applied outreach_prospects table.

alter table public.outreach_prospects
  add column if not exists freshness_signals text[] not null default '{}';
