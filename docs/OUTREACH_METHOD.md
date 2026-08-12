# Outreach method — how a message gets written

The reproducible half of `docs/OUTREACH_FIVE.md`. That doc is the *experiment* (one question, a
decision rule, what actually happened). This one is the *procedure*, so a later session can run
another batch without rediscovering it.

**Last run:** batch 2, 2026-08-12 · 10 businesses contacted, 15 touches logged.

---

## 0. The line this method is built around

> **The machine says who you MAY write to. A person decides what to say.**

`docs/OUTREACH_FIVE.md` carries a standing rule — *do not build a tool for this* — and it is right
about the message. "Built from their own words" is the product, and templating is the first thing
that destroys it. But nobody's judgement improves by hand-counting menu items across 26 JSON blobs,
and doing that by eye is how eleven drafts with **invented menus under real businesses' names**
nearly went out.

So the split is deliberate and permanent:

| mechanised | stays human |
|---|---|
| who is eligible, and why everyone else isn't | which detail to lead with |
| what is on their page (menu, hours, address) | how to say it |
| flagging likely parse failures | whether the flaw is worth admitting |
| logging what was sent, verbatim | reading the draft as the owner would |

If anything in `lib/outreach/candidates.ts` or `scripts/outreach-candidates.ts` starts producing
prose, that is a bug in the design.

---

## 1. Find who is eligible

```bash
npm run outreach:candidates              # eligible list + why everyone else is out
npm run outreach:candidates -- --all     # show the disqualified rows too
```

⚠️ **The headline number is a trap.** "26 unclaimed drafts" is not 26 prospects. On 2026-08-12 it was
**2**. The script always prints the exclusion breakdown first, for that reason.

Disqualifiers, in the order they are reported (`lib/outreach/candidates.ts`):

| reason | why it disqualifies |
|---|---|
| **`placeholder-menu`** | **The #738 class: the food scaffold's invented dishes under a real restaurant's name. NEVER SEND ONE.** Telling a business "I built you a page" where the page lists food they don't serve is the worst artifact this pipeline can produce. |
| `already-contacted` | Derived from `outreach_touches` at run time, never a pasted list of ids — a hardcoded array is correct exactly once. |
| `no-phone` | Nothing to text. |
| `menu-too-thin` | Under 8 items there isn't enough of their own material for the page to look like *theirs*, which is the variable under test. |
| `no-menu` | No menu block at all. |

Reported eligible ≠ send. **Open every draft and read it as the owner would** before writing.

---

## 2. Find one verified hook per business

```bash
npm run outreach:candidates -- --detail <slug>
```

Prints contact, hours (flagging weekdays the page omits), and every section/item/price, plus two
automatic warnings: every-item-same-price (a parse failure) and the doubled-`$` price bug.

**One hook per business, and a different *kind* of hook each time.** Five messages built the same
way is a template set wearing five coats of paint. The hooks that worked, strongest first:

1. **Something they are losing right now.** *"Your sandwiches are listed B1–B6 and the page never
   says bánh mì anywhere, so anyone searching that won't find you."* Offers a gain rather than
   apologising for a possible mistake. Best of batch 1.
2. **A flaw in our own work, stated first.** *"Every item came out at $14 — that's obviously not
   right."* The most unfakeable thing available: nobody selling you something opens by saying their
   thing is broken.
3. **Something only a person who looked would know.** A Street View landmark, a dessert menu nobody
   would guess from the name, a counter inside a gas station.
4. **A gap we can't resolve without them.** *"Your hours skip Monday — closed, or did I miss it?"*
   Ends on a question they can answer in four words.

**Where hooks come from:** the `--detail` dump, the live page, Google Street View, and their own
reviews. **Never from our database's own description fields** — those are ours, not theirs.

### The three traps, all of which have bitten

⚠️ **Confidently wrong is worse than generic.** A draft for the taco truck opened *"you're a truck,
so if you move around that page is wrong."* A truck parked at a fixed 76 station does not move —
the address was right. The offer only became strong once the premise was correct: from *"I'll remove
something"* to *"I'll add the thing that gets you found."*

⚠️ **Pick the phrasing that is true under every reading you can't rule out.** Street View showed a
dessert counter *in or near* a salon. The message says **"over by"** — true either way. Same
discipline as holding a metric at "200,000+" rather than a number you can't source.

⚠️ **Don't name a neighbour as a landmark if the neighbour is also on your list.** Two of batch 1
were across the street from each other. If both messages name the other, a personal note inverts
into a sweep of the block. (They were also supposed to go two days apart, and didn't — see the
deviations table in `OUTREACH_FIVE.md`.)

---

## 3. Write it

Same order every time, because it earns the right to the next sentence:

> **I found you** → **here's what I made** → **here's what might be wrong with it** → **here's why
> there's no catch.**

The location line buys the credibility that makes "I made you a page" land as care rather than spam.

**Rules that are not style preferences:**

- ⚠️ **Full `https://` URL on a `.com`.** Use `https://deliveredmenu.com/<slug>` (301s to
  `delivered.menu` preserving the path). Phones autolink from a TLD list that `.menu` is not on — a
  bare `<slug>.delivered.menu` arrives as **plain text**, hyphen-wrapped across four lines, while
  the phone happily linkifies a date and a street address in the same message. Three tappable
  things, none of them the site. Guarded by `lib/outreach/__tests__/messageLinks.test.ts`.
- **No claim link in a cold message.** It is a bearer credential — whoever opens it owns the site.
  It goes in the *reply*, after a human answers. Mint at that moment (30-day TTL).
- **No link to a personal portfolio.** It reads as a job-seeker's résumé, which tells an owner
  *he may not be here in six months* — the exact abandonment fear that makes "free" suspicious.
- **No "20+ years of experience."** They can't check it and aren't evaluating seniority; they're
  deciding whether you're a scammer.
- **State the exit.** *"If you'd rather I take it down, say the word and it's gone today."*
- **The download line answers "what's the catch" better than any credential** — but press the button
  once for *that* business first. It resolves the host per-site, and that is where two of its seven
  bugs lived.
- **Locality is a claim about you, not them.** Once the inventory spreads past your own city,
  "I'm local in Renton" becomes "I'm local, over in Renton." Don't upgrade it.

---

## 4. Send, then log verbatim

Log every touch to `outreach_touches` (`lib/outreach/touches.ts`, visible at `/admin/outreach-log`).

⚠️ **Paste what was sent. A summary is not evidence of what you said** — and the whole test turns on
what was actually said. When backfilling, extract from the source file programmatically rather than
retyping; retyping makes the record a paraphrase of itself.

`already-contacted` in step 1 reads this table, so logging is what keeps the next batch from
double-texting someone.

---

## 5. Record deviations *before* the results arrive

The experiment is pre-registered. That only means something if the conditions it was registered
under are the ones that actually held.

Every departure goes in `OUTREACH_FIVE.md` **with its effect on interpretation** — batch 1 alone
accumulated four: the broken link, two neighbours texted the same day, two touches instead of one,
and a mitigation ("restart the clock") that stopped being true within the hour and was marked
retracted rather than deleted.

⚠️ **A confound that can only produce a false negative still destroys the decision rule.** If a
business never saw the page, their silence is not evidence about the offer — so a 0–1 result stops
triggering "stop building outreach tooling," while a 4–5 result gets *stronger*.

---

## 6. What not to do

- ⚠️ **Do not build a message generator, a send button, or a flyer→site pipeline.** The trap is more
  tempting *because* there was a success to justify it. Five by hand costs an afternoon; the tool
  costs a month and answers worse.
- **Do not send to the whole list.** The number under test is the reply rate on a good-faith
  personal approach; 127 blasts measure something else while burning the list.
- **Do not count a click as a reply.** It isn't one. A refusal is.
- **Do not run a new city sweep to refill the list without asking.** It spends Places API budget —
  an owner decision, not a session one.

---

## Related

- `docs/OUTREACH_FIVE.md` — the experiment, the batches, the deviations
- `lib/outreach/candidates.ts` — eligibility, with a reason per exclusion
- `scripts/outreach-candidates.ts` — the CLI
- `lib/outreach/touches.ts` — the verbatim log
- `lib/menu/menuBlocks.ts` — why a menu must be read from **both** block shapes
- `docs/RESTAURANT_VERTICAL.md` §7b — the listing-import pipeline that builds the drafts
