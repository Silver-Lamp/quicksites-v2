-- 20260818_agreements.sql
--
-- Agreements: present a document to a named person and record that they signed it.
--
-- ⚠️ WHAT AN ELECTRONIC SIGNATURE ACTUALLY IS, BECAUSE THE DESIGN FOLLOWS FROM IT. Under ESIGN
-- (US federal, 2000) and UETA (adopted in nearly every state), a signature is valid when there is
-- intent to sign, consent to transact electronically, the signature is ASSOCIATED with the record,
-- and the record can be RETAINED and REPRODUCED. Nothing requires a vendor, a certificate
-- authority, or a notary for an ordinary commercial agreement.
--
-- The load-bearing word is "associated". A row saying "Eiji signed" is worth nothing on its own —
-- it is a claim about a document, and if the document can change afterwards the claim is empty.
-- So a signature stores the SHA-256 of the exact text that was on screen, and the text itself is
-- frozen once anyone signs. That is this repo's own rule (verify the artefact, not the inputs)
-- applied to contracts: what matters is what the person was SHOWN, not what the record says now.
--
-- ⚠️ WE DO NOT CLAIM MORE THAN WE RECORD. This is not notarisation, not identity verification,
-- not eIDAS qualified, and no code or copy anywhere may imply it is. What we can honestly say is
-- exactly what these columns hold: who we sent the link to, what they typed, when, from what
-- address, and the fingerprint of what they read. Overstating that would be the same class of
-- dishonesty as billing a narrator as the owner's voice.
--
-- Deny-default RLS. An agreement is a private document between two named parties, and the signer
-- has no account — access is a signed token in a link (lib/agreements/signToken.ts), checked in
-- the route, exactly like the collab and site-claim tokens.

create table if not exists public.agreements (
  id            uuid primary key default gen_random_uuid(),

  -- Shown as the document's heading, and in the email subject.
  title         text not null,

  -- The document, in markdown. ⚠️ FROZEN ONCE SIGNED — see the trigger below.
  body_md       text not null,

  -- Who is asking for the signature. Free text: the party name as it should appear on the
  -- document ("Point Seven Studio LLC"), not a user id.
  party_name    text not null,
  party_email   text,

  -- Who is being asked. The email is where the signing link goes, so possession of that inbox
  -- is the identity evidence — the same standard as every low-cost e-sign product.
  signer_name   text not null,
  signer_email  text not null,

  -- The operator who created it. Null tolerated so a seed script can create one before an
  -- operator account is involved.
  created_by    uuid,

  -- draft → sent → signed → voided. Free text; the app owns the vocabulary.
  status        text not null default 'draft',

  -- Set when voided, so a withdrawn agreement says WHY rather than vanishing.
  voided_at     timestamptz,
  voided_reason text,

  created_at    timestamptz not null default now()
);

create table if not exists public.agreement_signatures (
  id            uuid primary key default gen_random_uuid(),
  agreement_id  uuid not null references public.agreements(id) on delete cascade,

  -- ⚠️ THE FINGERPRINT OF WHAT WAS ON SCREEN. Not of the row as it stands now — of the exact
  -- canonicalised text the signer was shown at the moment they signed. A signature whose document
  -- can be edited afterwards is not evidence of anything.
  document_sha256 text not null,

  -- What they typed as their signature, verbatim. Kept separate from `agreements.signer_name`
  -- because they are different claims: one is who we addressed, the other is who signed.
  typed_name    text not null,

  -- ⚠️ REQUIRED BY ESIGN, NOT DECORATION. Consent to transact electronically is a statutory
  -- element, so it is a NOT NULL column with no default — a caller cannot forget to ask.
  consented_electronic boolean not null,

  signed_at     timestamptz not null default now(),

  -- The audit trail. Weak evidence individually, meaningful together, and honest either way
  -- because we describe it as exactly what it is.
  signer_ip     text,
  user_agent    text,

  created_at    timestamptz not null default now()
);

-- One signature per agreement. A second one would mean the first was insufficient, which is a
-- different feature (counter-signing) and should not arrive silently as a duplicate row.
create unique index if not exists agreement_signatures_one_per_agreement
  on public.agreement_signatures (agreement_id);

create index if not exists agreements_signer_email_idx on public.agreements (lower(signer_email));

-- ⚠️ THE DOCUMENT IS FROZEN ONCE SIGNED, AND THIS IS ENFORCED IN THE DATABASE RATHER THAN ASKED
-- FOR IN A COMMENT. Editing the text under an existing signature would silently convert "they
-- agreed to this" into "they agreed to whatever it says now" — the single worst thing this
-- feature could do, and it would look like an ordinary edit in every UI.
create or replace function public.guard_signed_agreement()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.agreement_signatures s where s.agreement_id = old.id) then
    if new.body_md is distinct from old.body_md or new.title is distinct from old.title then
      raise exception 'agreement % is signed; its text cannot be changed (void it and issue a new one)', old.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_signed_agreement on public.agreements;
create trigger trg_guard_signed_agreement
  before update on public.agreements
  for each row execute function public.guard_signed_agreement();

alter table public.agreements enable row level security;
alter table public.agreement_signatures enable row level security;

-- Deny-default: no policies. Every read and write goes through a route that has either verified a
-- signing token or checked an operator session, using the service-role client. The signer is
-- unauthenticated by design, so there is no session for a policy to key on.
