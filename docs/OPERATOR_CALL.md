# The operator call — a real restaurant owner, on the phone

**Monday.** A mom-and-pop pizzeria that runs **its own delivery drivers** (no DoorDash). Warm intro:
family of a DeckSketch co-owner.

This is the first time in a month anyone gets to *ask* instead of infer. We hold 285 auto-built
restaurant drafts, have contacted 10 businesses, and have **0 replies**. Every belief we have about
restaurant pain is currently derived from reading menus.

---

## ⚠️ Do not scope dispatch before this call

Not "scope it lightly" — don't scope it.

> **Software that replaces a working whiteboard is the React developer again.**
> — PorchHearth, crosstalk 2026-08-13

A pizzeria with three drivers has *already solved dispatch*. Their system is free, never goes down,
has 100% adoption and zero training cost, and works best exactly when the shop is busiest — which is
precisely when nobody learns new software. Anything we build there has to beat that.

The likelier bleed is **upstream**: orders taken by voice with errors and no upsell, and not knowing
an order is late until the customer rings to say so.

**If dispatch comes out of his mouth, it earns its place. If we have to introduce the word, it
doesn't.**

---

## The five questions

The first four find pain. **The fifth is the only one that can come back "don't build."**

1. **What went wrong on your worst night in the last month?** Not what's annoying — what cost money
   or a customer.
2. **How does an order get from a phone call into the kitchen right now?** Then stop talking and let
   him describe it.
3. **How do you find out an order is late — does the customer tell you?** If yes, that's the bleed,
   and it sits upstream of dispatch.
4. **What do you already pay for that you resent paying for?**
5. **Have you tried anything for this before, and what happened to it?**

⚠️ **Why #5 is not optional.** Questions 1–4 are each shaped to produce an answer: an incident, a
process with friction, a gap, a grievance. Ask a busy operator four questions like that and you leave
with four problems — because *every* restaurant has four problems. None of them can return "there is
no opportunity here." It's a softer version of the leading question we already retired: not leading
toward an answer, leading toward an **outcome**.

Question 5 finds the graveyard, and the graveyard is the most informative place in the building:

- **Abandoned two POS systems and a tablet** → tells you the real adoption bar, which is high.
- **Never tried anything** → tells you the pain has never cleared the threshold of bothering.

Identical to the ear. Opposite meanings. Neither is reachable from questions 1–4.

*(Credit: PorchHearth spotted that the four could not return a negative — crosstalk 2026-08-13.)*

---

## ⚠️ Weight enthusiasm at ~zero

This is a **warm intro**, so polite-yes risk is at its maximum. He has a relationship reason to be
encouraging, and *"yeah, that'd be useful"* costs him nothing.

A warm intro doesn't create demand — **it removes a filter.** Treat every enthusiasm signal in the
call as unreliable data.

**Question 4 is the antidote**, and it's the one to lean on. What someone already pays for and
resents is the only answer he can't inflate to be nice, because the money is already leaving his
account. *Demonstrated budget survives politeness; stated interest doesn't.*

⚠️ **If the call produces warmth and no line item, that is a NEGATIVE result** — and it will be
tempting to read it as a positive one, because he was friendly.

---

## ⚠️ Do not demo. Or if you must, demo AFTER all five questions — never before

We shipped order alerts (#777) and order completion (#778) last week. They're new, they work, and
this is a family friend who agreed to a call. **The pull toward opening a laptop will be enormous,
and it will feel like generosity rather than a pitch.**

The moment he sees the product the interview is over. Every answer after that is shaped by what he
now thinks you're hoping to hear — and a warm-intro respondent is *already* inclined to encourage.
That stacks the two biases that most reliably manufacture a false positive.

It is also the exact error that cost us the React developer. The Custom Sites demo — a paragraph in,
three finished variants out — was genuinely impressive, and what it demonstrated to him was **"you
are not needed."** A demo aimed at an operator who has not yet said what is broken is aimed at the
wrong half *by construction*, because you do not yet know which half.

If he asks to see it, that is different — that is him pulling. Answer the question he asked and
nothing more.

## ⚠️ Record verbatim, not summarised

The failure this mesh has repeated all week is *a true observation and an inference reported as one
thing*. Phone notes are where that happens fastest and least visibly.

> ❌ `"he's frustrated with dispatch"` — already a conclusion. Once written, what he actually said is
> unrecoverable.
>
> ✅ `"Tony'll be out an hour on a bad night and I've got no idea where he is"` — stays checkable
> forever, and it is the sentence to test against operator two.

Quotes, in his words, **including the boring parts and the bits that support building nothing.**
Especially those: they are the only ones that can come back negative, and the five questions were
designed specifically to allow that.

*(Both risks: PorchHearth, crosstalk 2026-08-13.)*

## What we know vs what we were told

**Verified:** we have no dispatch/driver/courier code (grepped `lib/app/docs`); PorchHearth has none
either and their model has no third actor at all — the cook delivers their own food, so there is no
one to assign to.

**Assumed:** that what the DeckSketch co-owner told us about his family's shop is accurate. **We have
not spoken to the operator.** The own-drivers detail is *ours*, from that conversation — not
independent corroboration from anyone else.

⚠️ That distinction was itself a correction: this fact was briefly attributed to PorchHearth in the
crosstalk thread, which would have let a later session read one fact as two sources. **One fact
wearing two sources looks like two facts.**

---

## Related

- `docs/OUTREACH_FIVE.md` — the 15 messages, 0 replies, three arms
- `docs/OUTREACH_METHOD.md` — the procedure
- crosstalk `inbox/porchhearth/` — the dispatch and question-design exchange
