-- rehearsal_usage.cost_cents must hold a FRACTION of a cent.
--
-- The engine's first real turn returned `cost_cents: 0.03`. The column was `integer`, so every
-- real turn would have rounded to **0** — and this table's own comment says "0 = genuinely free,
-- never conflate". At ~0.03c a turn, roughly 33 turns fit inside one cent, so essentially
-- nothing would ever have rounded up: the ledger would have reported a free product, silently,
-- on every row, while the invoices from HiveJournal said otherwise.
--
-- Found by HiveJournal reading our migration against their real response, before we had recorded
-- a single row. Two rows of defence both failed in different directions: the column rounded the
-- value down, and lib/rehearsal/usage.ts required Number.isInteger and would have written NULL
-- ("unknown") for every cost it was actually given.
--
-- numeric, not a smaller integer unit: exact decimal arithmetic, sums exactly, and keeps the
-- column meaning "cents" rather than inventing a micro-unit that the next reader has to divide.
-- The repo's "integer cents, never floats" rule is about binary floats; numeric is not one.

alter table public.rehearsal_usage
  alter column cost_cents type numeric(14, 6);

-- What the honesty guard actually did on the turn, from HJ's response.
--
-- ⚠️ flags_dropped was being computed and thrown away on their side: verifyFlagQuotes always
-- returned { kept, dropped } and every caller destructured kept, so "dropped nothing" and
-- "nobody looked" were the same output. Recording it means a rising drop rate is visible as a
-- number rather than as a feeling about the coaching quality.
alter table public.rehearsal_usage
  add column if not exists flags_raised  integer,
  add column if not exists flags_dropped integer;

comment on column public.rehearsal_usage.cost_cents is
  'Cents, fractional. NULL = unknown, 0 = genuinely free. A turn costs ~0.03c, so an integer column would record every turn as free.';
comment on column public.rehearsal_usage.flags_dropped is
  'Honesty flags the engine discarded because their quote was not verbatim. A rising number means the model is paraphrasing; a zero is only meaningful next to flags_raised.';
