-- 20260862_unresponsive_counts_nullable.sql
--
-- ⚠️ "0 UNANSWERED CALLS" AND "WE COULD NOT ATTRIBUTE ANY CALLS" ARE DIFFERENT FACTS, AND THE
-- FIRST REAL ROW WROTE THE WRONG ONE.
--
-- The first re-point (covingtontow.com → Prime Towing, 2026-09-30 09:24 PT) filed AL Ram Towing
-- as unresponsive with `unanswered_calls = 0, answered_calls = 0`. AL Ram had missed two real
-- leads that morning. The counts were not wrong so much as unanswerable: `forwardHealth` counts
-- only call rows carrying `forwarded_to`, and those three predate `20260861`, so they are
-- `unattributed` — deliberately, since inferring them from the campaign's mutable `forward_to`
-- is the guess that migration exists to refuse.
--
-- But `0` is not how you write "unknown". Sitting beside a note that reads *"operator dialled it
-- directly; no answer"*, a zero count contradicts the evidence on its own row. Worse, it is a
-- laid trap: `suggestsUnresponsive({answered: 0, unanswered: 0})` is FALSE, so the moment
-- anything re-evaluates these rows automatically it would conclude this one was unwarranted and
-- clear a correct entry — using a number that never meant what it would be read to mean.
--
-- NULL is the honest value, and the columns must be able to hold it. This is the same shape as
-- `call_logs.forwarded_to` being left unbackfilled one migration earlier: where a system does
-- not know, it must be able to say so rather than emit a confident zero.

alter table public.forward_unresponsive
  alter column unanswered_calls drop not null,
  alter column unanswered_calls drop default,
  alter column answered_calls drop not null,
  alter column answered_calls drop default;

comment on column public.forward_unresponsive.unanswered_calls is
  'Attributed unanswered calls at the time of writing. NULL = we could not attribute any (e.g. rows predating call_logs.forwarded_to), which is NOT the same as zero. The note carries the evidence in that case.';
comment on column public.forward_unresponsive.answered_calls is
  'Attributed answered calls at the time of writing. NULL = unattributable, never "none".';

-- The one existing row: its counts were written as 0 by the bug above, and its evidence is the
-- operator's own direct call. Correct it to NULL rather than backfilling a 2 that our data
-- cannot actually prove belongs to that destination.
update public.forward_unresponsive
   set unanswered_calls = null,
       answered_calls = null
 where phone = '+12532347959'
   and unanswered_calls = 0
   and answered_calls = 0;
