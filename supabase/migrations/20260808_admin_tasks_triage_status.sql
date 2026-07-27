-- admin_tasks: allow status='triage'.
--
-- Needed by the cross-mesh persona-testing receiver (crosstalk/contracts/persona-testing.md).
-- An AI persona's finding is a CLAIM until a human agrees, so it must NOT land as 'open' —
-- 'open' reads as confirmed work, and one bad browse session would flood the real queue and
-- stop it being trusted. That's the cry-wolf failure the mesh hit three times in a day, just
-- slower. 'triage' is the holding state: recorded, attributed, awaiting human confirmation.
--
-- The existing CHECK constraint would otherwise reject the insert at the database — the
-- status column is not free text.

alter table if exists public.admin_tasks
  drop constraint if exists admin_tasks_status_check;

alter table if exists public.admin_tasks
  add constraint admin_tasks_status_check
  check (status = any (array['triage','open','in_progress','blocked','done','cancelled']));

comment on column public.admin_tasks.status is
  'triage = machine-reported claim awaiting human confirmation (e.g. an AI persona finding); open = confirmed work.';
