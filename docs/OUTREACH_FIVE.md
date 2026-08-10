# The Manual Five

A pre-registered test of one question, by hand, with no tooling.

**Status:** not started · **Owner:** Sandon · **Written:** 2026-08-10

---

## The question

**Does handing someone a finished thing built from their own words get a reply, or did we get lucky once?**

We have exactly one datum: a driveway-repair contractor got a hand-made site, a printed flyer and
one personal text, and replied **"how much?"** — the first inbound from a stranger any product in
the mesh has logged.

PorchHearth audited that result and was right to deflate it: one prediction, one confirming reply,
and at least four mechanisms that could have produced it (locating the catch / a price check
before declining / assuming free was an intro rate / not having registered "free" at all). **One
reply is an absence of disconfirmation, not a finding.**

## Why by hand, and why not a pipeline

The thing that worked was unscalable on purpose: a flyer read closely, a site written in the
business's own words, a print pack, one personal message. **The "own words" part is the product,
and it is the first thing automation destroys.**

We already ran the scaled arm without meaning to. It is the control:

| | automated batch | the one bespoke build |
|---|---|---|
| sites produced | 25 | 1 |
| people contacted | **0** | 1 |
| replies | — | 1 |

⚠️ **Read that honestly: it is not "25 attempts, 0 replies."** Nobody was contacted. The pipeline
produced *inventory*, not conversations — which is the finding. Building the site was never the
bottleneck, so automating the building cannot be the fix.

## Pre-registered decision rule

Write this down **before** sending anything, so the result cannot be explained away afterwards.

- **4–5 replies of 5** → the offer is doing real work. *Then* ask what to automate, with data.
- **2–3 of 5** → something is there; run five more before concluding anything.
- **0–1 of 5** → the driveway contractor was a friendly individual, not a signal. Stop building
  outreach tooling and go find out why.

A "reply" is **any human response at all** — including "no thanks" and "take it down". A refusal
is a reply; silence is not. We are measuring whether the thing provokes a response, not whether it
converts.

⚠️ **Decide the timebox now too: 7 days from send.** A reply on day 20 is a different experiment.

## The five

All from the Renton sweep, all no-website, all with a real menu already transcribed from their own
public listing photos. Ordered by how much material the draft has — a fuller menu means the page
looks more like *theirs*, which is the variable under test.

| # | Business | Draft | Phone | Menu items |
|---|---|---|---|---|
| 1 | Enjoy Teriyaki | `enjoy-teriyaki-s7709` | (425) 793-7333 | 56 |
| 2 | Taqueria Los Potrillos #5 | `taqueria-los-potrillos-5-i3t57` | (206) 694-3872 | 40 |
| 3 | Renton Deli | `renton-deli-4edah` | (425) 226-7572 | 18 |
| 4 | Taqueria El 5 De Mayo | `taqueria-el-5-de-mayo-3cpt8` | (253) 408-3302 | 12 |
| 5 | Los Antojitos del Barber | `los-antojitos-del-barber-c4ffg` | (253) 402-6828 | 12 |

Each is live at `https://<slug>.delivered.menu` (watermarked + noindex until claimed) and has a
QR + claim link in `leads-renton-qr/`.

## Protocol — per business, in order

1. **Open the draft and read it as the owner would.** Fix anything that is not true of their
   business. ⚠️ This is the step the pipeline cannot do and the whole reason for doing five by
   hand — the menu came off photos and OCR is confident when it is wrong.
2. **Rewrite at least one line in their voice**, from their own listing/reviews. Not our copy
   about them.
3. **Send one short personal message** to the phone on their listing. Not a template. Name
   something specific about their place so it is obviously not a blast.
4. **Say the no-catch part out loud.** ⚠️ *"How much?"* is a trust probe — the person is trying to
   locate the catch, and the catch they are hunting for is lock-in. Shipping the export does not
   answer it; **saying it does**. Something like: *"Nothing — it's yours. I can send you the whole
   site as a zip to host anywhere, I don't need to be in the loop."*
5. **Log it verbatim** at `/admin/outreach-log` — what was sent, when, and any reply. Paste the
   real text, not a summary. A summary is not evidence of what you said.

## What NOT to do

- ⚠️ **Do not build a tool for this.** Not a template, not a send button, not a "flyer → site"
  pipeline. That is the trap PorchHearth named and it is more tempting *because* there was a
  success to justify it. Five by hand costs one afternoon; the tool costs a month and answers
  worse.
- Do not send to all 127. The number under test is the reply rate on a good-faith personal
  approach, and 127 blasts measure something else while burning the list.
- Do not count "they clicked the link" as a reply. It is not one.

## Known confound, stated in advance

These five have **no website at all**. PorchHearth's 857 FoodNome sellers *do* have a working
channel, and they got 0 replies to a platform invitation.

So if this comes back 4-of-5, it is evidence for **"a finished thing beats an account"** — but it
is entangled with **"someone with nothing values a site more than someone already selling."**
Both readings survive a positive result; only the second survives a negative one.

Naming it now so a good outcome cannot be claimed for the more flattering theory afterwards.

## Related

- `docs/RESTAURANT_VERTICAL.md` §7b — the listing-import pipeline that produced these drafts
- `lib/outreach/touches.ts` — the verbatim outreach log
- `scripts/import-listings-batch.ts` — now idempotent (#736); re-running a city refreshes rather
  than duplicates
