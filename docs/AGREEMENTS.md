# Agreements — presenting a document for signature

> Send a named person a private link, they read a document and sign it, and both parties end up
> holding a self-contained file that proves what was signed. No vendor, no per-document cost.
> First use case: the QuickSites volunteer contributor agreement.

---

## 1. Why we built it rather than bought it

There was nothing in the repo — no e-sign integration, no signature concept. The comparison:

| | cost | fits "a tool within QuickSites" |
|---|---|---|
| DocuSign | ~$10–45/mo | no — a vendor our customers don't have |
| Dropbox Sign | ~$15/mo | no |
| SignWell | free tier, 3 docs/mo | no |
| Documenso (open source) | self-host | maybe, but it is another service to run |
| **In-house** | **$0 marginal** | **yes — it can become a product surface** |

The deciding factor was not price. The ask was a capability *inside* QuickSites, and a vendor
doesn't satisfy that at any price. We already owned every primitive: signed subject-bound tokens
(`lib/auth/siteClaimToken.ts`, `lib/collab/collabToken.ts`), deny-default RLS, per-IP rate
limiting, Resend, and — from the Verbatim work the day before — the pattern for a self-contained
HTML artefact the person keeps.

**What we are NOT claiming, and this is a hard line:** this is not identity verification, not
notarisation, not eIDAS qualified. If a case genuinely needs a contested-identity-grade record, it
needs a vendor and this is the wrong tool. Say so rather than stretching what we have.

## 2. What actually makes a signature worth something

Under **ESIGN** (US federal, 2000) and **UETA** (adopted in nearly every state), an electronic
signature is valid when there is *intent to sign*, *consent to transact electronically*, the
signature is **associated with the record**, and the record can be retained and reproduced.
Nothing requires a vendor for an ordinary commercial agreement.

The load-bearing word is **associated**. A row saying *"Eiji signed on 4 August"* is a claim about
a document, and it is worth nothing unless you can say **which document**. So:

- **The signature stores a SHA-256 of the exact text that was on screen** (`lib/agreements/document.ts`).
  The hash is computed **server-side from the stored column**, never accepted from the client —
  otherwise the thing being attested chooses its own attestation.
- **The document is frozen once signed**, enforced by a database trigger
  (`guard_signed_agreement`), not by a comment or a code path. Editing text under an existing
  signature would silently convert *"they agreed to this"* into *"they agreed to whatever it says
  now"* — the worst thing this feature could do, and it would look like an ordinary edit in every
  UI. Verified by trying it: `ERROR: agreement … is signed; its text cannot be changed`.
- **Consent and a typed name are checked server-side**, not only in the browser. They are the two
  statutory elements; a UI-only check means they are simply *absent* for anyone who posts
  directly — which is exactly the record that would be challenged.

⚠️ **Canonicalisation must never change meaning.** `canonicalize()` exists so a Windows paste or a
trailing space doesn't break a signature. It does NFC, CRLF→LF, and trailing-whitespace stripping —
nothing else. No markdown rendering, no smart quotes, no case folding. Tests assert that
`"You agree"` and `"you agree"` hash **differently**; if that ever collapses, two different
agreements share a fingerprint and the whole mechanism is a lie. Changing this function is a
version boundary (`HASH_ALGO`), not a refactor.

## 3. The signer keeps their own copy

Same rule as the Verbatim export: **hand over an artefact, not a dependency.** The certificate
(`lib/agreements/certificate.ts`) is one HTML file with no script, stylesheet, font, image,
analytics or link back to us. It opens from a USB stick in ten years and prints on one sheet.

> A signing product whose evidence lives only on the vendor's server asks the weaker party to trust
> the stronger one about what was agreed.

It is downloadable **permanently** via the same token, not once at signing — someone who loses the
copy must not have to petition the other party for evidence.

And it states the limits in plain words, on the certificate *and* on the signing page before
signing, so nobody learns them afterwards. The tests assert the words *"legally binding"*,
*"certified"* and *"notarised by"* do **not** appear.

## 4. Using it

```bash
npx tsx --env-file=.env.local scripts/create-agreement.ts \
  --file ./agreement.md \
  --title "Volunteer Contributor Agreement" \
  --signer "Full Name" --email "them@example.com" \
  --party-email "you@example.com"
```

It prints the agreement id, the fingerprint, and the signing link. ⚠️ **That link is the
credential** — anyone holding it can sign as that person, so send it to the signer directly, never
to a shared inbox or a channel.

Two environment gotchas, both of which cost a cycle here:

- **Node 22.** `supabase-js` needs native WebSocket; Node 20 fails with
  *"Node.js 20 detected without native WebSocket support"*. Use `nvm exec 22.14.0 npx tsx …`.
- **`--env-file=.env.local` is required.** `SUPABASE_SERVICE_ROLE_KEY` is not set locally; the
  value lives in `SUPABASE_SECRET_KEY` and `instrumentation.ts` maps it at boot — which a plain
  script never runs. The store falls back to `SUPABASE_SECRET_KEY` for exactly this reason.

⚠️ **Never sign an agreement on someone's behalf to test the flow.** Doing so fabricates a legal
record attributed to a real person. Smoke-test with an obviously fictional signer on an
`example.invalid` address, and delete the row afterwards.

## 5. The "Agreements block" — a different product, and now built

The natural next surface is a block a site owner drops onto a page. It is worth being precise
about what changes, because the two are not the same feature:

| | **private link** (`/sign/<token>`) | **`agreement` block** on a public page |
|---|---|---|
| the verb | **signs** | **accepts** |
| who | one named person we emailed | any visitor |
| identity evidence | possession of that inbox | **none** — whoever is at the keyboard |
| document frozen | yes, by DB trigger | **impossible** — the owner can edit the block |
| good for | contracts, contributor agreements | waivers, terms, cancellation policies |
| table | `agreements` + `agreement_signatures` | `agreement_acceptances` |

**A block cannot inherit the private link's evidentiary weight**, because there is nobody to
address it to. That does not make it useless — a MEHKO cook's liability waiver, a contractor's
terms, an "I have read the cancellation policy" at checkout are all real, and all of them are
about *a visitor accepting stated terms*, not about proving which person signed.

So the language is enforced, not merely intended: **a test asserts the rendered block contains no
form of the word "sign"**. If that ever fails because someone improved the wording, the block has
started claiming an identity check it did not perform.

⚠️ **The full accepted text is stored on every acceptance row, and that is the design's crux.**
`agreements` freezes its document with a trigger; that is impossible here, because the terms live
in the template JSON and the owner can edit them through the ordinary editor at any moment. Storing
only a hash would leave us holding fingerprints of text nobody can reproduce — a record proving
something was accepted that cannot say what. The snapshot is redundant per row, cheap at these
volumes, and the only version that still answers the question a year later.

⚠️ **And the text is hashed from what the PAGE posted, not re-read from the template.** Re-reading
server-side would hash whatever is stored *now*, which is not necessarily what this visitor read if
the owner edited mid-session. The trade-off, stated plainly: a caller could post terms that were
never displayed. That is a limitation of any public form, it does not let anyone forge another
person's acceptance, and the alternative — hashing text the visitor may never have seen — is worse.

### Adding it to a site

The block is in the palette as **Agreement / Waiver** (`agreement`). Set a title and the terms;
optionally require an email. An unconfigured block shows a hint in the editor and renders
**nothing** on a published page.

Acceptances land in `agreement_acceptances`. There is no operator UI for reading them yet — query
the table, or build one (§6).

## 6. Known gaps

- **No email delivery yet.** The link is printed by the script and sent by hand. Resend is already
  wired (`lib/email.ts`); this is a small addition and deliberately not in the first slice, because
  a signing product that emails the wrong person is worse than one that makes you paste a link.
- **No operator UI.** Creating an agreement is a script, on purpose for now: it forces the document
  to exist as a file you have read. The fastest way to send someone the wrong contract is a form.
- **No counter-signature.** One signature per agreement, enforced by a unique index. Two-party
  signing is a real feature, not a duplicate row.
- **No void endpoint.** The columns exist (`voided_at`, `voided_reason`) and the signing page
  honours them; nothing sets them yet except SQL.
- **No operator view of block acceptances.** `agreement_acceptances` is written but never read
  back by any UI. A site owner collecting waivers currently cannot see them without SQL, which
  makes the feature half-delivered from their side.
- **No acceptance receipt for the visitor.** The signing product hands over a certificate; the
  block only shows a confirmation on screen. Someone who accepted a waiver has no copy of what
  they accepted, which is the weaker half of the same artefact-not-dependency rule. The
  certificate renderer already takes exactly the fields needed, so this is small.
