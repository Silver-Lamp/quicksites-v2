-- 20260860_postcard_returns.sql
--
-- RETURNED POSTCARDS — and the difference between "wrong address" and "gone".
--
-- ⚠️ THE COLUMN EXISTED AND NOTHING COULD WRITE IT. `postcard_mailings.returned_at` has been
-- there since the table was created; all 164 real rows still read `status='created'` because the
-- Lob webhook was never registered. Returns also arrive PHYSICALLY — a card in the operator's
-- mailbox — which no webhook will ever report. So marking a return is a human act, and until now
-- there was nowhere to put the observation.
--
-- ⚠️ THE TWO OUTCOMES ARE NOT THE SAME FACT, AND CONFLATING THEM IS THE EXPENSIVE MISTAKE:
--
--   • "wrong address, business is fine"  → a MAILING problem. Fix the address, send again.
--   • "out of business"                  → a PROSPECT problem. Every future sweep, build,
--                                          postcard and forward-to recommendation should stop
--                                          considering them, not just this one card.
--
-- Recording only the mailing would mean the pipeline cheerfully rebuilds a site for a closed
-- business next week, and the operator marks the next returned card the same way, forever.
-- Hence `outreach_prospects.closed_at`: a terminal state the SELECTION gates read.

alter table public.postcard_mailings
  add column if not exists return_reason text,
  add column if not exists returned_by uuid,
  -- Points at the mailing this one replaces, so a re-send is not counted as a second prospect
  -- reached. The funnel already dedupes by prospect; this keeps the lineage readable.
  add column if not exists replaces_mailing_id uuid references public.postcard_mailings (id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.postcard_mailings'::regclass and conname = 'postcard_mailings_return_reason_check'
  ) then
    alter table public.postcard_mailings
      add constraint postcard_mailings_return_reason_check
      check (
        return_reason is null
        or return_reason in ('bad_address', 'out_of_business', 'vacant', 'refused', 'moved', 'unknown')
      );
  end if;
end $$;

-- ⚠️ The terminal state for a prospect. NOT a `status` value: `status` tracks progress through
-- the funnel (discovered → draft_built → claimed) and a closed business can be at any point in
-- it. Overloading `status` would lose where they got to, and every existing
-- `.eq('status', 'draft_built')` filter would silently change meaning.
alter table public.outreach_prospects
  add column if not exists closed_at timestamptz,
  add column if not exists closed_reason text;

create index if not exists outreach_prospects_open_idx
  on public.outreach_prospects (closed_at)
  where closed_at is null;

comment on column public.postcard_mailings.return_reason is
  'Why the card came back. out_of_business additionally closes the prospect — see 20260860.';
comment on column public.outreach_prospects.closed_at is
  'Business is gone. Terminal: every selection gate (build, mail, forward-to) must skip these. Separate from status, which records how far they got.';
