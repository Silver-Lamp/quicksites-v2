# Audience split — who each surface is for

> Written for the owner, Amy and Daryle, ahead of the call. Prompted by Daryle's feedback after
> meeting a supplement-business prospect (2026-09-25).
>
> Status: **steps 1–3 BUILT 2026-09-25.** Step 4 (founding partner terms) is still blocked on the
> owner's numbers. See §7 for what shipped and the one correction the build made to this plan.

---

## 1. What a prospect hit BEFORE this change (measured, not remembered)

⚠️ This section is the **audit that motivated the work**, kept as written on 2026-09-25. Steps 1–3
have since shipped, so these figures are history, not the current page — §7 says what it looks like
now. Re-derive rather than trusting either: `grep -nE '<h2' components/home/home-client.tsx`.

| | before |
|---|---|
| Header nav items | **13** — Features · Restaurants · Realtors · Auto Shops · Job Seekers · Lemonade Stands · Partners · Pricing · Compare · Book · Contact |
| Homepage sections | **9** |
| Share of the homepage body that is reseller/network economics | **≈45%** (lines 328–494 of a 123–494 body) |
| `/pricing` | **924 lines** |
| `/partners`, `/partners/resellers`, `/partners/calculator` | public, **no `noindex`** — indexable today |

A small business owner scrolling quicksites.ai reached, in this order: industries → builder →
commerce → CRM → **"White-label it. Resell it. Earn the slice."** → **"Grow the network. Earn on all
of it."** → agency → "Build → Sell → Earn". The last thing they read is our channel comp plan.

These exact words were on the public homepage:

> "Send your **recruit link**. Anyone who signs up to resell through it becomes your **downline**."
> "You keep a **lifetime cut** of their sales…" · "Overrides accrue to your **commission ledger**."

**Daryle is right, and the evidence is stronger than his phrasing.** This is not a matter of a
prospect seeing too much detail. It is that the bottom half of our homepage is a different product
being sold to a different person.

---

## 2. One thing he asked for does not work the way it sounds

> "We don't want all of our direct clients knowing all the details of the multiple channels and
> payouts."

⚠️ **Moving a page does not unpublish it.** The payout details are public and indexable *now*. A
client who searches "quicksites reseller commission" finds `/partners/calculator` whether or not we
link to it from the homepage. Building a separate site for resellers relocates the link; it does not
remove the information.

So this is really two different asks, and they need different mechanisms:

- **"Don't put it in front of clients"** — an attention and sequencing problem. Fixed by removing
  the sections from the homepage. Cheap, and most of the value is here.
- **"Clients must not be able to find it"** — a confidentiality problem. Fixed only by gating, and
  gating means it stops working as inbound lead-gen for new resellers. That is a real trade, and it
  is the owner's call, not a technical detail.

We already have the gate and it is proven: `lib/auth/pagePin.ts`, running on `/for-amy`. It **fails
closed** — if the PIN env var is unset the page is unopenable rather than open. Adopting it is a few
lines per page.

---

## 3. There are three audiences, not two — and the wrong two are currently merged

Daryle described merchants vs resellers. The split that matters more is *inside* the reseller half:

| | who | what they want | sensitivity |
|---|---|---|---|
| **A. Merchant** | Daryle's supplement owner. A business with something to sell. | Will this sell my product, what does it cost, how fast can I be live | public, indexed — this is the front door |
| **B. Channel partner** | An agency, a processor, someone with a book of business | Margin, white-label, can I move my clients | public, indexed — ordinary SaaS channel lead-gen |
| **C. Network / founding terms** | Amy's recruits. People who recruit *other* resellers. | Override rates, payout mechanics, tiers | **this is the part that should not be on the open web** |

**B and C are currently the same page, and that pairing is what creates the problem.** "Resell our
software and keep a margin" is an unremarkable channel arrangement. "Recruit resellers and earn a
lifetime override on their downline" is a different proposition. Printed side by side under one
heading, the first is read in the light of the second.

⚠️ **Worth saying plainly because of who the prospect is.** The structure we actually built is a
two-tier affiliate override funded out of the platform's own 20% share — the reseller's 80% is
protected in code, and a level that does not fit is paid nothing rather than diluting anyone. That
is defensible and ordinary. But the *vocabulary* on the page — "downline", "recruit link",
"founding families" — is the vocabulary of something else, and **supplements is the single industry
where that association is strongest.** A supplement founder evaluating a web platform whose
homepage says "downline" has been given a reason to hesitate that our product does not deserve.

The recommendation is therefore **keep the structure, change the words.** "Downline" → "the partners
you bring on". "Recruit link" → "your partner link". "Earn the slice" → say the number.

### ⛔ "Founding families" is out on the QuickSites side — owner, 2026-09-25

Decided, and **HiveJournal/Cornerstone keeps it.** The owner's reasoning, which is the rule worth
keeping rather than just the verdict:

> **QS is business.**

That is the whole test. The word is right wherever the audience actually *is* families, and wrong
wherever it is a metaphor for a commercial relationship. Cornerstone is families; a QuickSites
reseller is a company. **Do not "harmonise" these later** — the fact that one mesh product uses a
warm word is not a reason for the others to. Shared vocabulary across the mesh is usually good and
here it is not, which is the kind of exception a future session will want to "tidy up".

It also collides, concretely. "Founding families" is HiveJournal's Cornerstone iPad pilot —
`lib/mesh/hjFoundingFamilies.ts`, contract `crosstalk/contracts/founding-families-counts.md`, and a
panel rendering on **our** `/admin/ops` headed *"Cornerstone founding families (HiveJournal)"*. They
are actual families, applying to an actual pilot.

Two costs, then, not one:

1. **A collision in one operator's dashboard.** The same person would see "founding families"
   meaning real families on HJ and a reseller commission tier on QS, on the same screen.
2. **The word changes register when it moves.** On HJ it is a description. On QS it would be a
   metaphor for people who recruit people — which is exactly the register that makes a two-tier
   override read as something it is not.

**Recommended replacement, and it is two names rather than one, because they are two things:**

- **The page: "Partner terms"** (`/partners/terms`). A page named after a cohort dates the moment
  the cohort closes, and this page outlives it.
- **The offer: a "charter rate."** Says early-and-favourable, carries no kinship, and survives being
  read aloud by someone who has heard a comp plan before.

Nothing is built on either name yet, so this stays cheap to change — but pick before the first one
is written down in front of a partner, because a rate is easy to revise and a name people have
started using is not.

---

## 4. Recommended structure

**Paths, not separate domains.** A second domain splits SEO, doubles maintenance, and the content
you would move there is the content you least want indexed anyway. Separate *hosts* already exist
for the case that genuinely needs them — white-label partners get their own branded host through
`org_domains` — so we are not giving anything up.

```
quicksites.ai/            → MERCHANT ONLY. Reseller sections deleted, not reordered.
    /pricing              → what a merchant pays. Nothing about commissions.
    /supplements  (new)   → vertical landing page, like /restaurants and /realtors
    /build                → sign up and start

quicksites.ai/partners    → CHANNEL. Margin, white-label, bring your book of business.
                            Public and indexed — this is lead-gen and should stay findable.
                            No override or downline language.

quicksites.ai/partners/terms  → NETWORK. Override rates, tiers, payout mechanics.
     ⚠️ NOT BUILT — and §7 explains why: there was no tier-C page to move, so this
     would have been an empty gated page holding numbers nobody has settled. It is
     step 4, and step 4 is the owner's.
```

Nav drops from 13 to **5 for the default visitor**: Features · Pricing · Industries (dropdown for
the verticals) · Compare · Contact. "Partners" moves to the footer — a channel partner who is
looking will find it; a merchant who is not looking is not distracted by it.

⚠️ **Delete the homepage reseller sections rather than collapsing them behind a toggle.** A "for
partners" tab on the merchant homepage is the same information in front of the same person, with an
extra click. The whole point is that the merchant page should not be selling two things.

---

## 5. Sequence

**First — before Daryle's meeting.** Nothing structural. One link he can send.

The reusable version is a **`/supplements` vertical page** on the pattern of `/restaurants`,
`/realtors` and `/secondset` (200-odd lines each, all shipped). Merchant framing only: catalog →
cart → checkout, what it costs, how fast. It outlives this one prospect, which the `/for-<name>`
one-pagers do not.

**Second — the homepage cut.** Remove sections 6–9, trim the nav. This is a deletion, so it is
fast, and it is where most of the benefit is. The reseller content is not lost; it already lives at
`/partners`.

**Third — split B from C.** `/partners` keeps margin and white-label. Override mechanics move to
`/partners/terms` behind the PIN. Language pass across both.

**Fourth — founding partner terms**, once the owner has settled the numbers.

---

## 6. Flag, specific to this prospect

⚠️ **A supplement storefront is the worst case for AI-generated copy, and we generate copy.** Our
own rule against inventing claims under a real business's name already exists because auto-shop
scaffolds wrote "licensed & insured" for shops nobody had spoken to, and listing imports produced
menus that were not real. A supplement site is that same class **with a federal regulator attached**
— "supports immune health" written by a model, published under the client's name, is their FTC
problem and our authorship.

Not a blocker, and not a reason to pass on the deal. But before this one goes live: either the AI
copy step is off for supplement catalogs, or every generated claim is owner-confirmed the way
restaurant menu prices already are. Worth knowing before the meeting rather than after the launch.

---

## 7. What shipped, and the correction the build made to this plan

⚠️ **Step 3 was wrong about where tier C lived, and finding out made it smaller, not bigger.**

The plan said to move the override mechanics off `/partners` and behind a PIN. Grepping for
`downline|lifetime override|recruit link|become a hub` across every public surface returned:

| surface | tier-C language | status |
|---|---|---|
| `components/home/home-client.tsx` | yes — three sections | **deleted** |
| `app/partners/*` (landing, resellers, calculator) | **none** | already clean tier B |
| `app/partners/dashboard` | yes | authenticated; correct place for it |
| `app/for-amy` | yes | already PIN-gated |
| `app/for-daryle` | yes | `noindex`, unlisted, linked from nowhere |

**There was no tier-C page to gate. The homepage was the tier-C page.** So deleting those sections
removed 100% of the public, indexed override exposure, and `/partners/terms` was not created —
building an empty gated page to hold numbers nobody has settled would be worse than not having one.
The gating decision in §8.1 is therefore **deferred into step 4**, where it belongs: it is a
question about the founding-terms page, and that page does not exist yet.

### Shipped

- **`/supplements`** — the merchant vertical page, on the `/restaurants` · `/realtors` ·
  `/secondset` pattern. ⚠️ Two product limits were read out of the source rather than assumed, and
  the page states both: checkout is `mode: 'payment'` so **there are no subscriptions** (close to
  table stakes in this category), and shipping is flat/per-item, not carrier-rated. It also carries
  a deliberate commitment — **we do not write health claims** — which is the §6 flag turned into a
  sentence a careful founder can hold us to.
- **Homepage** — the three reseller sections deleted; the commerce card that told a business owner
  *"you take a platform fee — your take-rate, set per merchant"* rewritten to the person actually
  reading it; the hero's "Become a partner" CTA replaced; "Build → Sell → **Earn**" → "Get paid";
  Partners and Contact added to the footer.
- **Nav 11 → 5**, verticals grouped under an **Industries** dropdown (click, not hover: keyboard
  reachable, closes on Escape / outside click / route change). The mobile sheet renders the group as
  a labelled list rather than a second nested disclosure, and carries Contact + Partners at the
  bottom — **the sheet replaces the nav, not the footer, so without that pair both would simply be
  gone on a phone.**
- **`/partners`** gains the reseller diagram, moved off the homepage with its data loader.
- **`components/home/__tests__/merchantHomepage.test.ts`** pins all of it. ⚠️ It strips comments
  before matching, because the deletion note left in the homepage names every forbidden word — the
  failure this repo hit three times in one day. It also asserts the stripper still leaves a
  substantial file, since a stripper that ate its input would make every other assertion pass.
  ⚠️ And its first draft banned the string `subscribe-and-save`, which **failed on the sentence
  saying we do not have it** — a token ban cannot tell a claim from its denial. It now forbids the
  affirmative constructions and separately requires the denial.

### Not done, deliberately

- No `/partners/terms`. See the correction above.
- No change to `/partners/resellers` or `/partners/calculator` — both were already tier B.
- **No rate published anywhere new.** Step 4 is the owner's.

---

## 8. Decisions that are the owner's

1. ⏸️ **Do the payout details come off the open web, or just off the homepage?** Deferred into step
   4 by §7 — there is no tier-C page yet, so there is nothing to gate. Recommendation when there is:
   gate tier C, leave tier B public.
2. ✅ **RESOLVED 2026-09-25 — "founding families" is out on the QuickSites side.** Owner's call. It
   is HiveJournal's program name for real families in the Cornerstone pilot, and it already renders
   on our own `/admin/ops`; see §3 for the collision and the two recommended names ("Partner terms"
   for the page, "charter rate" for the offer). **Still open: which replacement.**
3. ⏳ **What the terms actually promise.** Nothing has ever paid from this ledger — every
   `override_share` in production is 0 — so this is still the cheap moment to set it. Publishing a
   rate externally is a money decision and a commitment; it is surfaced here rather than assumed.
   ⚠️ Note the asymmetry with the naming decision above: **a rate is easy to revise and a name
   people have started saying is not.** The name is the one to settle first, even though the rate
   feels like the bigger question.
