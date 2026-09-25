# Audience split — who each surface is for

> Written for the owner, Amy and Daryle, ahead of the call. Prompted by Daryle's feedback after
> meeting a supplement-business prospect (2026-09-25).
>
> Status: **proposal, nothing built.** Three decisions at the bottom are the owner's.

---

## 1. What a prospect actually hits today (measured, not remembered)

Re-derive any of these: `grep -nE '<h2' components/home/home-client.tsx`, `ls app`.

| | today |
|---|---|
| Header nav items | **13** — Features · Restaurants · Realtors · Auto Shops · Job Seekers · Lemonade Stands · Partners · Pricing · Compare · Book · Contact |
| Homepage sections | **9** |
| Share of the homepage body that is reseller/network economics | **≈45%** (lines 328–494 of a 123–494 body) |
| `/pricing` | **924 lines** |
| `/partners`, `/partners/resellers`, `/partners/calculator` | public, **no `noindex`** — indexable today |

A small business owner scrolling quicksites.ai reaches, in this order: industries → builder →
commerce → CRM → **"White-label it. Resell it. Earn the slice."** → **"Grow the network. Earn on all
of it."** → agency → "Build → Sell → Earn". The last thing they read is our channel comp plan.

These exact words are on the public homepage right now:

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

On **"founding families"**: same issue, and it is the name itself. Suggest "founding partner terms"
or "charter partner terms" — it says early-and-favourable without the kinship framing. Amy's call;
flagging the reason, not vetoing the word.

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

quicksites.ai/partners/terms  (new)  → NETWORK. Override rates, tiers, payout mechanics.
                            PIN-gated via lib/auth/pagePin.ts. Not indexed. Link given
                            deliberately, by a person, to someone already in the conversation.
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

## 7. Decisions that are the owner's

1. **Do the payout details come off the open web, or just off the homepage?** Gating stops them
   working as inbound recruitment. Recommendation: gate tier C, leave tier B public.
2. **"Founding families", or a name without the kinship framing?**
3. **What the founding terms actually promise.** Nothing has ever paid from this ledger — every
   `override_share` in production is 0 — so this is still the cheap moment to set it. Publishing a
   rate externally is a money decision and a commitment; it is surfaced here rather than assumed.
