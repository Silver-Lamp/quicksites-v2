# The thrift probe — a funnel test with a kill criterion

**Status: PREPPED, NOT RUN.** Build, seed, publish and outreach need Sandon's direct word.
Prepped 2026-08-14.

This is **not** a third brand launch. It is the cheapest available test of the one question no
QuickSites directory has answered: *does an unclaimed page built from public data get claimed by the
business it describes?*

The engine is already built — a geo directory with search and a claim funnel is in production
(`kent-restaurant.com`, `paterson-restaurants.com`). The only net-new code is a resolver mapping an
apex label to a **city** rather than to a site slug.

---

## Why thrift and why now

Restaurants get web presence handed to them (Google Business Profile, Yelp, DoorDash, Toast), so a
new page competes with something they already have and low claim motivation is *expected*.
Curated/vintage/resale shops are Instagram-run, frequently have no real site, and want to sell
online.

⚠️ **That is a hypothesis, not a premise.** It has the same shape as *"they already had a channel"* —
a plausible category story that turned out to be a flattering description of a JSON file. Label it
as a prediction we can be wrong about.

Yard sales were the original candidate because a weekend reads by Sunday night. Dropped to spring
2027: the clean instrument is an organized community sale, and those are seasonal and passed for
2026 near Renton (Renton April, Kent/Covington June, West Seattle May, nothing in fall).

---

## 1. The measurable — pre-registered

⚠️ **THE OBVIOUS COUNTABLE READS 103 AND MEANS ZERO.** *"A listing_import draft acquired an owner"*
returns **103**, and every one of those 103 is owned by an operator account from building and
testing. A count that reads triumph while meaning nothing is the exact failure this repo spent a
week cataloguing.

**Use this, with the exclusion baked in:**

```sql
select count(*)
  from templates
 where claim_source = 'listing_import'
   and <thrift cohort predicate>            -- see §3, must exist BEFORE seeding
   and owner_id is not null
   and owner_id not in (select user_id from admin_users);
```

⚠️ **The exclusion is a SUBQUERY, not a literal uuid.** There are currently **two** admin accounts —
`sandon@pointsevenstudio.com` and `sandon@quicksites.ai` — so a hardcoded single id would have
missed one and reported a false claim. `admin_users` is the set; it can grow.

**Baseline: 0**, queried 2026-08-14, not assumed — across the entire `listing_import` population,
zero drafts are owned by a non-admin.

⚠️ **This instrument is fragile in a way `garage_sales` was not.** That one counted rows in an empty
table, so a row could only exist if a real sale was created. This one is *inferred* from
`templates.owner_id`, which means **one operator test-claim makes it read 1 when the truth is 0.**

> **Run rule: do not self-claim a thrift page while testing.** If internal testing needs a claim,
> use an account outside `admin_users` and note it, or the number is unusable.

**Kill criterion:** one non-internal claim. If the probe produces zero, stop — do not seed a second
metro, and change the channel, the offer, or the category before spending more.

---

## 2. Seeding — the manual half *is* the experiment

⚠️ **OSM tags cannot separate resale from charity.** Goodwill, Savers, Value Village and
St Vincent de Paul are frequently tagged `shop=second_hand`, **not** `shop=charity`. A tag-only pull
is therefore *mostly the non-converting segment*.

> **Anyone who plans this as "OSM pull → filter by tag → seed" builds a charity-bin directory and
> gets a cold read for a reason that has nothing to do with the funnel.**

The rule, in order:

1. **Exclude** `shop=charity`.
2. **Exclude by name, regardless of tag** — starting denylist: Goodwill · Savers · Value Village ·
   Salvation Army · St Vincent de Paul · Habitat ReStore · Deseret Industries · generic
   "Thrift Store".
3. **Keep** `shop=antiques`, `shop=second_hand`, `shop=clothes + second_hand=yes` that survive (2).
4. **Manual review before seeding.** Not data-cleaning — the segmentation *is the experiment's
   validity*.

⚠️ **Google Places is out.** Not mainly the ToS restriction on caching place data into a directory
you intend to rank — the harder reason is that our Places-seeded restaurant pipeline shipped
**11 of 26 drafts with an invented menu under a real business's name**. A directory whose entire
pitch is *"this is about your actual shop"* cannot afford that failure mode.

---

## 3. Cohort stamping — a pre-seed requirement

⚠️ **Decide this before any data goes in.** If thrift drafts land in the same undifferentiated
`listing_import` pool as the restaurants, the measurable in §1 cannot tell a thrift claim from a
restaurant one, and the probe has no readable result. Stamp the cohort distinguishably (industry
key, claim_source variant, or campaign) and put the predicate into §1's query.

---

## 4. The only net-new code

A resolver mapping an apex label → a **city**, then the existing directory query filtered by it.

Three brand hosts already resolve a label to a **site slug** (`delivered.menu`, `lemonyum.com`, the
`<city>-restaurant.com` apexes) — `menuSubdomainSlug()` and `lemonYumSubdomainSlug()` are the
pattern to copy. Label-means-geo is the one new line. Wildcard `*.thriftingshops.com` needs a
one-time Vercel attach.

---

## What this inherits from the restaurant probe

**285 → 390 drafts in six hours on 2026-08-14, while businesses contacted held at 19 and replies
held at 0.** Supply accumulates on its own; demand does not. Every branch of the restaurant decision
rule was rewritten to forbid "keep building pages" for that reason, and this probe inherits it:
**seeding more shops is never the answer to a cold read.**

## Related

- `docs/OUTREACH_FIVE.md` — the restaurant probe, its rewritten rule, and the confounds
- `docs/OUTREACH_METHOD.md` — the outreach procedure, if the probe reaches outreach
- `lib/outreach/candidates.ts` — eligibility, with a reason per exclusion
