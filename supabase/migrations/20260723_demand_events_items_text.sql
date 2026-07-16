-- Fix: demand_events.items holds free text ("what would you order?"), not JSON.
-- The capture route sends a plain string, which a jsonb column rejects ("2x tacos"
-- isn't valid JSON). Retype to text. Safe — the table is new and empty at this point.
alter table public.demand_events
  alter column items type text using items::text;
