# LemonYum — plan

> ⚠️ **NO MINOR'S VOICE ON THIS SURFACE — recorded or synthetic.** No owner-voice audio, no
> kid-recorded welcome, no cloned child voice. A minor cannot give the consent a voice artifact
> requires, and this binds the *real* child's recording as much as a clone — a kid's voice on a
> distributed commercial artifact is over the line regardless of how it was made. The stand does not
> need it: the child's actual voice is already there, live and in person. Ruled out jointly with
> HiveJournal 2026-08-17, symmetric on both sides. See CLAUDE.md §7.

*`lemonyum.com`, registered 2026-08-14, as the consumer-facing brand for parent-facilitated
lemonade stands. QuickSites is the engine; LemonYum is the address a customer actually sees.*

Status: **PLAN**. Phase 0 shipped (PR #794). Nothing else is built.

Related: [`RESTAURANT_VERTICAL.md`](RESTAURANT_VERTICAL.md) §7b (the `delivered.menu` pattern this
copies), `lib/menu/deliveredMenu.ts` (the host wiring to mirror), `lib/garageSales/payLinks.ts`
(the payment model this should adopt).

---

## 1. What it is

The same relationship `delivered.menu` has to restaurants: a branded, memorable host for the
end customer, with QuickSites' builder and commerce underneath. A stand is reachable at
`lemonyum.com/<slug>`, the apex is a directory, and the printed sign carries the short URL
instead of `<slug>.quicksites.ai`.

**Why a `.com` matters here and is not just taste.** `delivered.menu` taught this the expensive
way: a bare `<slug>.delivered.menu` **does not linkify in a phone's messaging app**, because
`.menu` is a new gTLD most link detectors don't recognise — so outreach had to route through
`deliveredmenu.com` instead. LemonYum being a `.com` means `lemonyum.com/ellie` is tappable
wherever a parent pastes it. Keep it that way; do not mint a `.lemonade`-style vanity host later
and assume it behaves.

---

## 2. ⚠️ Two things that must be decided before any of this ships

### 2a. DECIDED (owner, 2026-08-14): handles, not Connect

> *"we can do the garage sale route for lemonade"*

The inconsistency below is resolved in favour of the garage-sale model. Recorded rather than
deleted, because the reasoning is what stops someone re-adding a Connect requirement later.

#### The inconsistency it resolves

`/lemonade-stands` (shipped) describes a **Stripe Connect** flow: the parent connects a bank,
Stripe verifies their identity, money settles on Stripe's schedule. On the same day, the garage
sale vertical shipped the **opposite** answer to an identical problem — hand off to the seller's
own Venmo / Cash App / PayPal with the amount pre-filled, no KYC, no payout delay, seller keeps
100%.

A parent selling $2 cups has the same problem as someone selling a $5 lamp. The harder path went
to the parent, and there is no reason for that beyond the order the two features were built in.

**Decision: LemonYum adopts handles-first, Connect as an upgrade.** `lib/garageSales/payLinks.ts`
works unmodified. This also deletes the worst part of the `$10` idea — charging a parent before
we know Stripe will approve them, leaving them out of pocket *and* unable to take cards at the
moment they most need it to work.

Consequence if adopted: `/lemonade-stands` step 2 ("Connect where the money goes") needs
rewriting, and the honest-fees section changes — with handles there is no 2.9% + 30¢ at all,
which is a materially better story for a $2 cup.

### 2b. DECIDED (owner, 2026-08-14): no directory of stands

> *"don't necessarily need the map of where the stands are it's more to help the parents set up
> the stand"*

**There is no public map or directory of lemonade stands.** The apex is a setup guide for parents.
This is the safest available answer and it costs nothing — the printed sign works without a
directory, and the sign was always the product.

The reasoning is kept below because "add a stands directory" is an obvious-looking feature request
and this is the record of why it was declined.

#### Why it was never the same as garage sales

The garage-sale directory publishes an **adult advertising their own address**, and even there
the house number is withheld until the sale starts (`lib/garageSales/address.ts`).

A lemonade stand directory publishes **where a child will be on Saturday morning**. That is a
different artifact with a different reader, and "it's just what a sign on the corner already
says" is the argument that does not survive contact with the difference between *seen by people
driving past* and *queryable in advance by anyone*.

If a directory is ever revisited, the constraints it would have to meet are: opt-in and off by
default, block-level always (no `exact` option, unlike garage sales), live-window only, and never
a child's name. Meeting all four is possible — but the sign works without any of it, so the bar
for reopening this should be a concrete reason a parent asked for it.

---

## 3. Phases

### Phase 0 — the vertical (SHIPPED, PR #794)

`lemonade_stand` industry + scaffold (menu, story, order bar; deliberately **not** in
`FOOD_INDUSTRIES`, so no location map, hours or contact form), `/lemonade-stands` landing page,
printable table sign + cup cards (`lib/lemonade/standSign.ts`), nav + homepage industry entries.

### Phase 1 — the host

Mirror `lib/menu/deliveredMenu.ts` exactly; it is the reference implementation and has already
absorbed the mistakes.

- `lib/lemonade/lemonYum.ts` — `LEMONYUM_BASE_DOMAIN` from `NEXT_PUBLIC_LEMONYUM_BASE_DOMAIN`,
  **inert until set**, plus `isLemonYumHost` / `lemonYumSubdomainSlug` / `lemonYumPathSlug` /
  `lemonYumSiteUrl` / `apexRedirectTarget`.
- `middleware.ts`: rewrite `<slug>.lemonyum.com/*` and `lemonyum.com/<slug>/*` → `/sites/<slug>`.
- ⚠️ **Apex fence.** `delivered.menu` shipped with five QuickSites marketing pages live on what
  was supposed to be the restaurant's own address, and had to 307 them away (PR #722). The keeper
  from that fix: the reserved-path list must **rot in the safe direction** — an unknown first
  segment is treated as a *stand slug*, so a route added later is absent from the apex rather
  than leaked onto it.
- `standUrlFor()` (`lib/lemonade/standSign.ts`) prefers the LemonYum host once the flag is set,
  so printed signs carry `lemonyum.com/ellie`. Existing `<slug>.quicksites.ai` URLs keep working.

### Phase 2 — the apex: a setup guide, not a directory

`lemonyum.com/` is **for the parent**, per 2b. What it has to do is get someone from "I registered
this domain on a napkin" to a stand with a printed sign:

- what it is, in one screen, aimed at a grown-up;
- set-up walkthrough (name it → prices → your payment handle → print the sign);
- print the sign, which is the moment the product becomes real;
- the honest bits: you hold the payment account, we never touch the money.

No listing of stands, no map, no "sales near you" — see 2b.

### Phase 3 — payments

Adopt `payLinks.ts` (2a, decided). Concretely:

- Stand handles live at `data.meta.payment_handles` on the template (stands are `templates`, not a
  dedicated table like garage sales).
- The stand page needs a ring-up surface instead of cart/checkout. `RingUp` in
  `app/s/[code]/sticker-client.tsx` is the working component; extracting it to
  `components/pay/ring-up.tsx` and adding a `pay_ringup` block is the clean version — note that a
  new block type is five compile-required files (see the `adding-a-block-type` memory).
- `/lemonade-stands` copy: step 2 currently describes connecting a bank through Stripe. With
  handles there is no 2.9% + 30¢ at all, which is a materially better story for a $2 cup, so the
  honest-fees section shrinks rather than grows.
- Connect stays available for the parent doing this every weekend: a column, not a rewrite.

### Phase 4 — the mesh card

A LemonYum card on `hivejournal.com/point-seven-studio`, in the `SIBLINGS` array beside
QuickSites, PorchHearth and DeckSketch.

⚠️ **That page lives in the HiveJournal repo, which is read-only from here.** It is a crosstalk
message, never an edit — see CLAUDE.md §8b. Sent 2026-08-14; copy is in the message.

---

## 4. Open questions for the owner

1. **2a** — adopt handles-first for stands? (Recommended. Rewrites part of `/lemonade-stands`.)
2. **2b** — directory: opt-in and block-level, or no directory in v1? (Either is defensible; the
   default of "same as garage sales" is the one to avoid.)
3. Does LemonYum get its own visual identity, or is it QuickSites' chrome on a different domain?
   `delivered.menu` chose the former for restaurants.
4. Is `lemonyum.com` pointed at Vercel yet, and is the wildcard `*.lemonyum.com` attached? Phase 1
   is inert without it.
