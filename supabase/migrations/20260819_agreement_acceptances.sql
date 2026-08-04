-- 20260819_agreement_acceptances.sql
--
-- Acceptances of an on-page agreement block: a waiver, a terms notice, a policy acknowledgement.
--
-- ⚠️ THIS IS A DIFFERENT PRODUCT FROM `agreements`, AND CONFLATING THEM WOULD BE THE MISTAKE.
-- `agreements` addresses ONE named person by emailing them a private link, so signing evidences
-- possession of that inbox. A block on a public page has nobody to address — whoever is at the
-- keyboard can type any name. So this table records "a visitor accepted these terms", never
-- "this person signed", and no copy on the block, in the record, or in any export may say
-- otherwise. It is the right shape for a liability waiver or a cancellation policy, and the
-- wrong shape for a contract.
--
-- ⚠️ THE FULL ACCEPTED TEXT IS STORED ON EVERY ROW, ON PURPOSE. The `agreements` table freezes
-- its document with a trigger once signed; that is impossible here, because the text lives in the
-- template JSON and the site owner can edit it at any time through the ordinary editor. If we
-- stored only a hash, an owner editing the block would leave us holding fingerprints of text
-- nobody can reproduce — a record that proves something was accepted and cannot say what. Storing
-- the snapshot is redundant per row and cheap at these volumes, and it is the only version that
-- still answers the question a year later.

create table if not exists public.agreement_acceptances (
  id            uuid primary key default gen_random_uuid(),

  -- Where it happened. The block id scopes it within a page, so a site with two waivers keeps
  -- them apart even after the page is rearranged.
  template_id   uuid references public.templates(id) on delete set null,
  block_id      text,

  -- What the visitor was shown, verbatim, and its fingerprint. See the header.
  document_text   text not null,
  document_sha256 text not null,
  document_title  text,

  -- What they typed and, if the block asked, how to reach them. Both are self-reported: this is
  -- the honest limit of a public form and the column comments say so.
  typed_name    text not null,
  email         text,

  -- ⚠️ No default, same as agreement_signatures: consent is a statutory element, not a checkbox
  -- a caller may forget.
  consented_electronic boolean not null,

  accepted_at   timestamptz not null default now(),
  visitor_ip    text,
  user_agent    text,

  created_at    timestamptz not null default now()
);

create index if not exists agreement_acceptances_template_idx
  on public.agreement_acceptances (template_id, accepted_at desc);

comment on column public.agreement_acceptances.typed_name is
  'Self-reported. A public page cannot verify who is at the keyboard — never present this as a verified identity.';
comment on column public.agreement_acceptances.document_text is
  'Snapshot of the exact text shown. Stored per row because the template is editable and cannot be frozen.';

alter table public.agreement_acceptances enable row level security;

-- Deny-default: no policies. Inserts go through the public route with the service-role client
-- after rate limiting; reads are operator-side only. A visitor may not read other people's
-- acceptances, which is why there is no select policy rather than a permissive one.
