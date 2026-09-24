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

## ⛔ OPEN — not decided, do not answer it by inventing a number

**Is there a second level?** Amy asked on 2026-09-23 whether she earns on business brought in by
someone *her* recruit recruits. There is no rule, because the model has exactly **one manager slot
per account**. `/for-amy` says plainly that it is undecided and the owner's call.

Anyone extending this: the answer changes the arithmetic (a third share has to come from somewhere,
and by decision #2's logic it cannot come from the closer), so it needs a decision here **before** it
needs code. Until then no surface may imply a third level exists.

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
