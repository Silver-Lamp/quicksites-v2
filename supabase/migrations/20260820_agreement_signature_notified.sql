-- 20260820_agreement_signature_notified.sql
--
-- Did both parties actually get told?
--
-- ⚠️ WHY THIS IS A COLUMN AND NOT A LOG LINE. Notification runs AFTER the signature is recorded
-- and must never be able to fail it — a delivery problem cannot be allowed to undo an agreement
-- someone signed. But the other half of that decision is the dangerous one: if a send fails and
-- nothing records it, the signature looks complete and both parties are simply never told, which
-- is the silence-looks-like-success failure aimed at a legal record. So the outcome is stored on
-- the row: `notified_at` when both sends succeeded, `notify_error` when they did not.
--
-- A row with neither set means notification never ran at all — a third state, and deliberately
-- distinguishable from "ran and failed". Signatures recorded before this migration have both
-- columns null and that is the honest reading: nobody knows whether anyone was emailed, because
-- nothing was.

alter table public.agreement_signatures
  add column if not exists notified_at  timestamptz,
  add column if not exists notify_error text;

comment on column public.agreement_signatures.notified_at is
  'Set when BOTH parties were successfully emailed. Null with a null notify_error means notification never ran.';
comment on column public.agreement_signatures.notify_error is
  'Why notification failed. Non-null means it ran and did not succeed — the signature is still valid.';
