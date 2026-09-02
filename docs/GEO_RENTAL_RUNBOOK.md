# Geo-domain rental — the operating manual

> Turning a domain that ranks into rent that arrives every month.
> Companion to [`docs/GEO_DOMAIN_MONETIZATION.md`](GEO_DOMAIN_MONETIZATION.md) (the model) and
> [`docs/RANKED_TARGETING_PLAN.md`](RANKED_TARGETING_PLAN.md) (how targets are chosen).
> The rep-facing half is `/for-sales`, `/for-sales/call` and `/for-sales/practice`.

**Who this is for:** whoever is running the rental funnel this week — operator, developer, or the
owner. Every step names what to run, what good looks like, and the specific way it has failed
here before.

**Last verified: 2026-09-02.** Every command and route below was checked against the running
system on that date. Where a figure is quoted, the command that re-derives it is quoted with it —
a number in a doc has no way of telling you it went stale.

---

## 0. The job, in one paragraph

We own exact-match `<city>-<trade>.com` domains, put a working site on each, and rent one to one
business in that town. The pitch is the **name and the exclusivity**, not the website. The close is
the **locked rate**: $99/month now, $399 once that domain reaches page one, and whoever rented at
$99 stays at $99. The job is a loop — measure what ranks, make the ranked ones rentable, pitch
them, take the money, confirm it arrived.

⚠️ **The order matters and is not obvious.** The instinct is to build more inventory. The evidence
says the opposite: on 2026-09-02 there were **99 rentable campaign domains, all `unranked`, all
created within the previous eight weeks** — and **eight other domains ranking on page one that
were not campaigns at all.** The thing that ranked could not be sold, and the thing for sale did
not rank. Fixing that is step 2, and it needs no code.

---

## 1. Measure what actually ranks

```bash
node scripts/gsc-rank-report.mjs --json     # refreshes lib/proof/rankingSnapshot.json
```

**Good looks like:** a `measuredAt` date of today and a `sites[]` array. Publishing the refreshed
snapshot updates `/proof/rankings`, which is the page a rep sends a prospect.

**Read it honestly:**

```bash
python3 - <<'PY'
import json; d = json.load(open('lib/proof/rankingSnapshot.json'))
print('measured', d['measuredAt'], d['window'])
for s in sorted(d['sites'], key=lambda x: -x.get('impressions', 0)):
    p1 = [q for q in s.get('queries', []) if q.get('position', 99) <= 10]
    if p1:
        print(f"{s['host']:28} clicks={s.get('clicks',0):3} impr={s.get('impressions',0):5} "
              f"page1={len(p1)} best={min(q['position'] for q in p1):.1f}")
print('unreadable:', d.get('unreadable'))
PY
```

⚠️ **`unreadable` is not an empty list and should be read every time.** A property we cannot see
(`no access to property`) returns nothing and looks exactly like a property with no traffic.

⚠️ **Position and traffic are different claims.** In the 28 days to 2026-08-21 the whole fleet
took **20 clicks on 1,536 impressions**. `bonneylake-towing.com` held position 7 on 619
impressions for **one** click. *"This domain ranks"* was true; *"this domain delivers calls"* was
not evidenced. Never let the second sentence ride in on the first.

---

## 2. Find the gap: what ranks vs what is rentable

```sql
-- Rentable inventory and its rank state
select coalesce(rank_status,'(null)') rs, count(*), count(subscription_status) rented
from geo_industry_campaigns group by 1 order by 2 desc;

-- Is a ranked domain actually rentable? (paste the hosts from step 1)
select domain, rank_status, subscription_status
from geo_industry_campaigns
where domain in ('graftontowing.com','richland-towing.com','southhilltowing.com');
```

**Good looks like:** every domain that appeared in step 1 comes back as a row here.
**On 2026-09-02 that query returned nothing at all** — the eight ranked domains were not campaigns,
so no rep could sell them and no pricing tier applied to them.

⚠️ **Do not read "all `unranked`" as a broken pipeline.** The `geo-rank-sync` cron
(`app/api/cron/geo-rank-sync`, registered in `vercel.json`, daily 08:00 UTC) calls
`deriveRankStatus()` and writes `rank_status` + `rank_position`. Confirm it before blaming it:

```sql
select job, status, started_at, error from cron_runs
where job ilike '%rank%' order by started_at desc limit 5;
```

If those rows say `ok`, then `unranked` is the **right answer** for a domain nobody searches yet —
a two-month-old domain has no impressions, and that is a fact about the domain, not the sync.
*(This runbook's first draft claimed the sync was missing. It was not. Check the cron table.)*

---

## 3. Make a ranked domain rentable

A campaign row is what makes a domain sellable: it carries the price, the rank state, the pitch
site and the checkout.

- **UI:** `/admin/growth?tab=prospects` → launch the city+industry campaign.
- **API:** `POST /api/admin/prospects/geo-campaign` (admin session), which checks availability,
  stands up **one** claimable pitch site whose slug is the domain's apex label, links the competing
  no-website prospects, and returns the campaign.

**Good looks like:** a campaign row whose `domain` exactly matches the ranked host from step 1.

⚠️ **Match the host exactly.** `graftontowing.com` and `grafton-towing.com` are different domains;
GSC reports the one that ranks, and a campaign on the other one inherits none of it.

**Then wait one cycle.** Rank is not set at creation — the cron fills it on its next 08:00 run.
Re-run the step-2 query the following morning and expect `page1` on a domain that ranked in
step 1. If it is still `unranked` a day later, that is now a real defect worth chasing.

---

## 4. Make the site worth landing on

```
POST /api/admin/templates/run-readiness-pipeline     # one site, or a small sequential batch
```
Runs every applicable readiness action in registry order (office address from the industrial-park
registry, `LocalBusiness` schema, a `<service> in <city>` subpage) and reports per-step status plus
a before→after score. The coach at the top of the editor has a **▶ Run steps** button for the same
thing.

Publish with **Save & Publish** in the admin (`/api/admin/sites/publish`).

⚠️ **Never edit template `data` by path.** The same content lives in
`.pages[].content_blocks[].content`, `.pages[].blocks[].content` and `.pages[].blocks[].props`. A
path-specific edit updates one copy, reports success, and leaves the renderer possibly reading
another. Walk the whole tree (see `scripts/publish-geo-campaigns.mjs#walkStrings`).

⚠️ **Check what the visitor gets, not what the editor shows.** The public render serves the
published snapshot, not `templates.data`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/
```

⚠️ **Scrub invented promises before anyone sees it.** Generated sites have shipped with "fully
licensed and insured", "we respond within the hour" and fabricated five-star reviews **on pages
presenting as a real named business that never agreed to any of it**. Read the live page before
you point a rep at it.

---

## 5. Price it

The campaign needs a flat plan and a price before checkout will work — `geo-campaign/rent` returns
`400 "Set a flat plan + price on this campaign first."` otherwise. Defaults come from
`priceTier(industry)` in `lib/outreach/geoPricing.ts` (premium trades: $99 locked → $399 full).

⚠️ **The locked rate is permanent for that renter.** Every early sale caps its own upside for the
life of the account. That is deliberate — it is the entire reason to sign today — but it is a real
cost and it should be a decision, not a default someone clicked past.

---

## 6. Pitch it

- **`/for-sales`** — the brief: what it is, what it pays, what is not proven. Read once.
- **`/for-sales/call`** — the call sheet: six beats, ten objections with the move *and* the trap,
  and the one rule. Works offline and prints; keep it open or on paper during the call.
- **`/for-sales/practice`** — rehearse against an archetype; anything you cannot back up gets
  quoted back to you (admin-gated: each turn spends money).
- **`/proof/rankings`** — the page you send a prospect who asks whether this works.

⚠️ **The one rule: never promise a ranking, a call volume, or a result.** Sell the name, the
exclusivity and the locked price — all three are true and checkable. A promise is what ends up in
a complaint with the rep's name on it.

⚠️ **Two of our own surfaces are each true and jointly misleading.** `/for-sales` says several
domains rank on page one (true — the older ones). The business plan says none of the 99 campaign
domains has (also true). A prospect shown both forms a false picture. **When you point at
`/proof/rankings`, say which domains it covers** — and prefer pitching a domain that is itself on
that list.

---

## 7. Take the money

```
POST /api/admin/prospects/geo-campaign/rent     # admin only → Stripe Checkout link
```

Send the link, they enter a card, the webhook writes back.

⚠️ **`geo-campaign/rent` is `if (!operator) 403`.** Only an admin can generate a link, which makes
the operator the bottleneck the moment a rep starts closing. Decide before hiring, not after —
it is written on `/for-sales` as a week-zero conversation for exactly that reason.

---

## 8. Confirm the money arrived — in our records, not Stripe's

```sql
select domain, subscription_status, payment_count, last_payment_at, last_invoice_id
from geo_industry_campaigns where domain = '<domain>';
```

**Good looks like:** `payment_count` incrementing on renewals and `last_payment_at` moving.

⚠️ **Check our row, not the Stripe dashboard.** Stripe showing a payment proves Stripe took money;
it does not prove we recorded it. That gap is exactly how a live rail sat unproven while a sales
page said it worked. Commission accrual (`commission_ledger`, closer + manager override, idempotent
on invoice id) and payouts are visible at **`/admin/splits`**.

⚠️ **A trial is not a rental until it bills.** One "trial customer" produced zero subscription rows.
If it has not billed, the honest count is zero.

---

## 9. The weekly loop

| cadence | do this | why |
|---|---|---|
| Weekly | Step 1, then step 2 | New page-one domains are the only new *sellable* inventory |
| Weekly | Any newly-ranked domain → step 3 | A ranked domain nobody can rent earns nothing |
| Per close | Steps 5–8 | The money path is only proven per-transaction |
| Monthly | Re-read `/proof/rankings` dates | A stale snapshot on a prospect-facing page is a claim about today made from last month |

---

## Traps, all observed here

| Trap | What it looks like | The check |
|---|---|---|
| Ranked ≠ rentable | 8 page-one domains, none a campaign | Step 2's `where domain in (…)` query |
| Position ≠ traffic | "We're #1" on 1 click / 619 impressions | Quote clicks beside position, always |
| `unranked` blamed on the sync | 99/99 unranked | `cron_runs` says `ok` → the domains are simply new |
| Editor ≠ visitor | Fixed in the editor, unchanged live | `curl` the live URL |
| Path-specific `data` edits | "16 reworded", 15 still carried them | Walk the whole tree |
| Invented promises | "licensed and insured" on a business that never said it | Read the live page before pitching |
| Stripe ≠ our records | Money taken, campaign still reads unrented | `payment_count` on the row |
| Trial counted as revenue | "1 trial customer" → 0 subscriptions | Count rows, not conversations |
