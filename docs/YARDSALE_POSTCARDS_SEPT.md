# September postcards → yardsalesites.com — a plan, and the problem it has to solve first

**Status:** PLAN ONLY. Nothing built, nothing bought, no mail sent. Written 2026-08-17.

---

## 1. The problem nobody has named yet: there is no list

Every outreach campaign this repo has run started from a list. Restaurants came from Google
Places; auto shops came from a nine-industry sweep; geo-domain prospects came from a territory
score. The machinery assumes a knowable prospect.

**Yard sale hosts are not a knowable population.** They self-identify by putting a sign at the
kerb, three days before the sale, having decided the week before. On the day you would need to
mail them — three weeks out, for September — *they do not yet know they are your prospect.*

This is not a data-sourcing gap to be closed with a better scraper. It is the shape of the
market. Any plan that starts "build a list of people who will hold a yard sale in September" is
already wrong.

### What that leaves

| Instrument | Mechanism | Cost | Fit |
|---|---|---|---|
| **USPS EDDM** | saturate every address on a carrier route; **no list required** | ~$0.20–0.24/piece postage + print | The only instrument whose targeting matches the market's shape |
| Lob addressed mail (built, flag-gated) | needs a name + address per piece | ~$0.55–0.90/piece | Wrong tool — we have no addresses to put on it |
| Last year's Craigslist/FB hosts | scrape historical listings | cheap | Stale, unaddressed, and a person who sold their stuff last year has less to sell this year |
| Signs at the kerb | put a flyer where sales already are | ~free | Reaches *buyers*, not sellers — see §3, this may be the point |

⚠️ **The postcard pipeline we already have is the addressed kind.** `POSTCARD_MAIL_ENABLED` +
Lob, built for the geo-domain campaigns where a business name and street address exist. It is
**not** the EDDM instrument, and EDDM is not an API — it is a USPS retail process with a paper
form, a carrier-route selection map, and bundling requirements. Assuming our existing pipeline
covers this would be the single most expensive mistake in this plan.

## 2. The evidence we already have, stated honestly

**Restaurants: 19 businesses contacted across four arms, 24 touches, 0 replies.**
(`docs/OUTREACH_FIVE.md`.) The pre-registered reading of that result: *no evidence the mechanism
provokes response at this volume* — `P(0|19)` is 0.014 at a true 20% rate, so it argues against a
strong converter while remaining consistent with ~10%.

⚠️ Two things not to do with that number:

- **Do not read it as "cold outreach fails."** It is 19 hand-written messages to restaurants
  about a menu site. A postcard to a household about a yard sale is a different audience, offer,
  and season. The prior is weak evidence, not a verdict.
- **Do not read it as 25/0 either.** The automated batch produced 25 *sites* and contacted
  **nobody**. That figure is inventory, and a denominator built from it would be arithmetic
  across two different experiments.

**The one thing that has produced a response from a stranger in this mesh is a finished, useful
physical artifact handed over with no ask** — the driveway flyer, and PorchHearth independently
called it "the only mechanism that has worked." That is the strongest signal available, and it
points at the *content* of the card more than at the channel.

## 3. The sequencing question this plan cannot dodge

A yard-sale page helps a seller only if **buyers use it**. Its value proposition is footfall.

- Buyer-side demand is real and measurable: **10k–100k/mo** for "garage/yard sales near me",
  low competition (owner checked Google's planner). That is why yardsalesites.com was bought.
- Buyer-side supply is **zero**. There is no directory of live sales yet. PorchHearth's
  equivalent surface aggregates 5 listings and has never taken an order.

So a September postcard recruiting sellers is selling a page into an empty directory. Two
orderings, and they are genuinely different bets:

**(a) Supply first.** Postcards recruit sellers in September; the directory fills; SEO then has
something to rank. Risk: the first sellers get a page nobody visits, and the pitch ("more buyers
will find you") is a claim we cannot yet support. Making that claim before it is true is the
invented-menu failure in a new costume.

**(b) Demand first.** Rank for "yard sales near <city>" *before* recruiting, so the first seller
arrives to an audience already searching. Cheaper (SEO is work, not postage), slower (rank takes
months — the same months the geo-domain plan is already waiting on), and September is too soon.

**My read:** neither, in September, at volume. See §4.

## 4. What I would actually do, and it is smaller than a campaign

⚠️ **A September saturation mailing is a bet placed before the cheap experiment has been run.**
EDDM's minimum sensible unit is a full carrier route — roughly 400–800 households, ~$150–250
all-in for one route. That is affordable, which is exactly why it is tempting to skip the step
that tells you whether the card works at all.

**Step 1 — settle the honesty question (free, blocking).** Write the card's copy first and see
whether it can be true. "More buyers will find your sale" is not currently true. What *is* true:
*"a page for your sale, with your photos and your address, that you can text to anyone"* and
*"we'll list it on yardsalesites.com"*. If the strongest honest sentence is not compelling, no
amount of postage fixes it, and we have learned that for the cost of an afternoon.

**Step 2 — use the channel we already have and have not exhausted (near-free).** The lemonade
stand puts a real person in front of neighbours in a driveway, repeatedly, in exactly the
neighbourhoods a yard sale happens in. A card handed over there — a *useful* one, per §2, the
September QR they keep in a drawer — costs a print run and tests the same copy with a warm
introduction. **If the card does not work handed to a smiling neighbour who just bought lemonade,
it will not work arriving cold in a stack of mail.** That is a strictly cheaper, strictly stronger
test of the same hypothesis.

**Step 3 — one carrier route, September, only if Step 2 says the copy lands.** Pick the route
around the stand so the two channels reinforce (the neighbour may have seen the card twice, which
is the point). Attribution by a route-specific short code, not "how did you hear about us".

**Step 4 — measure the thing that matters.** Not scans, not visits: **sales listed.** A scan is a
person being curious; a listing is a person trusting us with their Saturday.

## 5. Guardrails carried over from the mesh (2026-08-17)

- **The child is not a sales force.** If a card goes out with the lemonade, an adult hands it
  over, and it is useful rather than promotional. The test HJ sharpened: *could the child be seen
  as the one doing the selling.*
- **Disclosure.** The card names Point Seven Studio, for the same reason the footer does: a
  neighbour meeting LemonYum and YardSaleSites separately should learn they are one operator from
  us, not work it out later.
- **No claim we cannot support.** Specifically not "more buyers", until buyers exist.

## 6. Open questions — owner calls, not mine

1. **September, or spring?** Yard sale season peaks in spring; September is the second peak. If
   the copy is not ready, waiting for April costs nothing and buys a stronger directory.
2. **Which comes first, supply or demand?** §3. This is a genuine strategy fork, not a detail.
3. **Does the card carry the neighbour's OWN sale code, or a generic one?** The useful-artifact
   argument says theirs (it is a thing they own). The cost argument says generic (one print run).
   I lean theirs, printed on demand from the stand's own print sheet.
4. **Budget ceiling for a first route**, if Step 3 happens at all.
