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

## ⛔ OPEN — owner intent is stated; the mechanism is not built

**Owner direction, 2026-09-23:** Amy is **head of business development** and should get "a cut of
everything that goes through anyone downstream of her."

**What exists:** exactly **one level**, on both rails. `lib/commerce/orders.ts` §5b reads
`codeRow.parent_code`, pays that one code, and stops — there is no walk up the chain. Rentals have
exactly one manager slot per account.

**So a chain three deep pays the middle link, not the top.** If Amy recruits Daryle and Daryle
recruits Bob, Bob's sale pays Daryle. Amy earns nothing on it.

Two decisions are needed **before** code, and neither may be answered by picking a plausible number:

1. **The rate on the commerce rail** (currently 0, ceiling = `QS_FEE_SHARE`).
2. **Where a second level's share comes from.** Both rails deliberately protect whoever closed the
   sale, so by decision #2's logic it cannot come from them — which leaves the house share, which has
   a floor (`QS_MIN_NET_KEEP_CENTS` exists precisely to stop QS going negative). A multi-level scheme
   that ignores that floor pays commissions out of money the business needs to operate.

Until both are settled, **no surface may imply a second level exists.** `/for-amy` states the gap
explicitly and advises building wide rather than deep — because the failure mode is that she recruits
a tier which earns her nothing and discovers it afterwards, which is the same class of harm this
whole file exists to prevent.

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
