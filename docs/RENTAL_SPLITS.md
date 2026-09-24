# Rental commission splits — who gets what on a geo-domain rental

> `lib/commerce/rentalSplits.ts` has cited this file since 2026-08-25 and **it did not exist** until
> 2026-09-23. That is worse than an ordinary broken link: the thing it was citing this file for is
> the record of what a person is owed, and the one number nobody had written down anywhere a rep
> could read it — the manager override — is the number Amy had to ask about directly.

**The code is the source of truth, not this file.** `SPLIT` and `splitRentalPayment()` are what the
payment handler, `/admin/splits` and the rep-facing pages all call. This file records the *decisions
and the reasoning*, which a function signature cannot hold.

## The split

Shares of the **net** (gross minus Stripe), never of the sticker price.

| party | share of net | note |
|---|---|---|
| Closer | **50%** | always, regardless of who recruited them |
| Manager — standard | **15%** | managing a rep they did not recruit |
| Manager — recruit | **25%** | managing a rep they brought in |
| Point Seven | remainder | takes the rounding dust deliberately |

At today's $99 tier: net **$95.83** → closer **$47.91**, manager **$23.95** (recruit) or **$14.37**
(standard), house **$23.97**. At the $399 page-one step the manager's recruit override is **$96.78**.

⚠️ **The manager's raise is funded entirely out of the house share.** The closer gets 50% either way.
Recruiting must never compete with selling, and the person doing the work must never pay for the
person who introduced them.

⚠️ **The house takes the remainder rather than its own percentage.** Three independently rounded
shares do not reliably sum to the total, and a split that is a cent off is a split somebody
reconciles by hand every month. Dust lands in the house slice — the only party positioned to absorb
it and the only one that does not have to be told.

## Owner decisions, settled 2026-08-25

1. Split the **net**, not the sticker price.
2. A manager closing their own sale takes the closer's 50% and **no** override.
3. Residuals continue while active, then a bounded tail.
4. A commission is earned when the payment **sticks**; a refund inside 120 days reverses it.
5. Plan on the $99 tier; treat $399 as upside.

## Both residuals follow the ROLE, not tenure

A rep is paid for as long as they are *the rep on that account* — the person the business calls about
renewals and questions. That is why it can run for the life of the account without becoming a
pension: they are still doing something, and the something is the support conversation that would
otherwise land on us. It ends when the role ends, and transfers to whoever picks it up, or to the
house.

**The manager override works the same way, for the same reason.** It runs while the manager is
supporting that closer and that account; if they stop, it stops.

⚠️ **Deliberately NOT "the recruiter keeps earning on someone they recruited and then stopped
supporting."** The 25% rate exists to make building a team worth doing; paying it to someone who has
stopped doing it turns recruiting into a one-off bounty collected forever, which is the incentive
this avoids.

⚠️ **An earlier draft said the residual ended "12 months after they leave".** That was a number
chosen rather than agreed, and it contradicted `/for-sales` and `/for-shelly`, which had already
promised the life of the account in three separate places. **Two surfaces disagreeing about what a
person is owed is worse than either rule.**

## The other rail: commerce platform fees (`lib/commerce/partner-terms.ts`)

A rental is one product; **commerce** is the other — a merchant runs online ordering on us and we
take a fee per order. The upline mechanism there is the **hub override**, and it behaves differently
enough that conflating the two will produce a wrong promise:

| | rental (`rentalSplits.ts`) | commerce (`partner-terms.ts`) |
|---|---|---|
| basis | net of one rental payment | the order's platform fee (cap 10% of the order) |
| person who sold it | closer, 50% | reseller, **80%** of the fee |
| upline | manager, 15% / 25% | hub, `override_share` per code |
| funded from | house share | **QS's 20% only** — `clampOverrideShare` caps at `QS_FEE_SHARE` |
| rate today | settled | **0 on every code** |

⚠️ **The commerce ceiling is arithmetic, not policy.** The reseller's 80% is protected in code, so an
upline's cut can only come from QS's 20% of the fee. At the cap, QS's share of that order is **zero**.
On a $10k/month merchant at a 5% fee: fee $500, reseller $400, and **$100 is the absolute maximum any
override could ever pay**. Anyone promising an upline "a cut of everything" needs that number in front
of them first.

## Multi-level: BUILT on BOTH rails (commerce 2026-09-24, rentals 2026-09-24)

`lib/commerce/uplineChain.ts` walks `parent_code` upward and pays every level. **Inert until rates
are set** — every `override_share` is 0, so it allocates nothing and behaviour is unchanged today.

**Commerce** (`orders.ts` §5b) draws from `QS_FEE_SHARE`; the reseller's 80% is protected.
**Rentals** (`rentalCommissions.ts` → `allocateRentalUplines`) draw from the **house remainder**,
because the closer's 50% *and* the manager's override are both protected. Rates live on the same
`referral_codes.override_share` column for both, so "who earns above whom" has one record rather
than two that can disagree. Subject `rental_upline_override`, listed in `RENTAL_SUBJECTS` so a
refund voids it — a new subject left out of that array is a commission that survives a refund.

⚠️ **`allocateUplineOverrides`'s `availableShare` is REQUIRED, not defaulted.** It used to default to
`QS_FEE_SHARE`, which made the module import `partner-terms` and therefore read env — unusable from a
client bundle without silently falling back to defaults, and wrong for rentals, whose slice is the
house remainder. Making it explicit turned the compiler into the reviewer: it named every call site.

⚠️ **The cap is on the TOTAL, and that is the only reason this is safe.** One level could be bounded
per-level by `clampOverrideShare` (≤ `QS_FEE_SHARE`). N levels each at that ceiling would pay **N ×
the slice that exists** — out of the house share, then through the floor, appearing as "revenue is
down" rather than as an error.

⚠️ **Nearest-first, and a level that does not fit is paid NOTHING rather than a reduced amount.**
Scaling everyone proportionally would silently shrink a rate someone agreed to in writing because a
level was added elsewhere in the tree — the same harm decision #2 forbids. The consequence, which the
owner must accept rather than discover: **if the direct upline's share consumes the slice, a
head-of-BD two levels up earns zero on that order.** The remedy is a bigger slice (costs the house)
or smaller per-level rates, never a cleverer allocator. Shortfalls raise a Sentry warning because
somebody is configured for a rate the order cannot pay.

⚠️ **Cycle detection is load-bearing, not defensive.** `parent_code` has no foreign key and no
acyclicity constraint, and neither writer (`/api/admin/referrals/set-hub`, `/api/partners/join`)
checks. A→B→A is one mistyped field away, and the walk runs **inside the Stripe webhook** — an
unbounded loop there means money taken and no order marked paid. Guarded twice: the fetch loop and
the pure walker each carry their own seen-set, because the fetch would spin before the tested
cycle-breaking code ever ran.

✅ **Verified the rest of the chain already handles N rows.** Refund voiding filters on `subject_id`
without `referral_code`, so it reverses every override row for an order; `summarizePlatformRevenue`
sums by subject. No schema change was needed — `commission_ledger`'s conflict key is
`(referral_code, subject, subject_id)`, so each upline gets its own row for the same order.

## ⛔ OPEN — two decisions, and rentals still need one

**Owner direction, 2026-09-23:** Amy is **head of business development** and should get "a cut of
everything that goes through anyone downstream of her."

1. **The rate on the commerce rail.** Currently 0 on every code; ceiling is `QS_FEE_SHARE`. This is a
   person's pay — it is set by the owner, not inferred.
2. ✅ **DECIDED 2026-09-24: rentals get a second level, funded from the house.** Built; see above.
   The trade it commits to: the house keeps ~$23.97 of a $99 rental, and that is what buys the
   domain and funds the ranking work. At 15% of net a second level leaves **$9.60 per account** to
   do all of it. Model it before setting a rate:
   `npx tsx --env-file=.env.local scripts/commission-scenarios.mts`

Until #1 is set, **both** mechanisms pay nothing.

## Where it is surfaced

- `lib/commerce/rentalSplits.ts` — the arithmetic, pure, no DB
- `lib/commerce/rentalCommissions.ts` — writing the ledger rows
- `/admin/splits` — the operator view
- `/for-sales`, `/for-amy`, `/for-daryle`, `/for-angela` — the rep-facing pages, which import `SPLIT`
  rather than quoting it, so a rate change cannot leave a stale promise on a page

## ⚠️ Nothing has ever been paid

As of 2026-09-23 `commission_ledger` has **zero rows**, `payout_runs` **zero**, and all six
`referral_codes` carry `override_share = 0` with no `parent_code` linked — so the override would
currently compute to nothing for everyone. The mechanism is built and the rate is settled; the
configuration is an owner action. **"The feature exists" and "it is switched on for this person" are
different sentences**, and every rep-facing page must keep saying which one is true.
