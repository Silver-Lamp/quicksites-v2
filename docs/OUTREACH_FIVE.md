# The Manual Five

A pre-registered test of one question, by hand, with no tooling.

> **Running another batch?** The reproducible procedure — who is eligible, how a hook is found, the
> rules that are not style preferences — lives in **[`OUTREACH_METHOD.md`](OUTREACH_METHOD.md)**.
> This doc is the experiment and its results; that one is how to do it again.

**Status:** **all five sent 2026-08-11**, correction follow-up sent to all five the same day ·
replies open until **2026-08-18** (the pre-registered 7-day timebox) ·
**Owner:** Sandon · **Written:** 2026-08-10

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

| # | Business | Phone | Menu items |
|---|---|---|---|
| 1 | **Enjoy Teriyaki** | (425) 793-7333 | 56 |
| 2 | **Taqueria Los Potrillos #5** | (206) 694-3872 | 40 |
| 3 | **Renton Deli** | (425) 226-7572 | 18 |
| 4 | **Taqueria El 5 De Mayo** | (253) 408-3302 | 12 |
| 5 | **Los Antojitos del Barber** | (253) 402-6828 | 12 |

⚠️ All five verified **not placeholder-only** (see #738 — 11 drafts in the batch had the food
scaffold's invented menu under a real restaurant's name; none of these five). All five return 200.

### Links

**1. Enjoy Teriyaki** — (425) 793-7333
- see it: https://enjoy-teriyaki-s7709.delivered.menu
- edit: https://www.quicksites.ai/admin/templates/27af7a44-8df5-402c-a4e7-b6671bf45b64

**2. Taqueria Los Potrillos #5** — (206) 694-3872
- see it: https://taqueria-los-potrillos-5-i3t57.delivered.menu
- edit: https://www.quicksites.ai/admin/templates/f50b2599-c4a1-4bac-b9bf-afa82cc901f0

**3. Renton Deli** — (425) 226-7572
- see it: https://renton-deli-4edah.delivered.menu
- edit: https://www.quicksites.ai/admin/templates/ac99b0b5-f173-4f37-ba5f-9a4e38437e22

**4. Taqueria El 5 De Mayo** — (253) 408-3302
- see it: https://taqueria-el-5-de-mayo-3cpt8.delivered.menu
- edit: https://www.quicksites.ai/admin/templates/a6389d12-d759-4815-89e5-75dd176644d1

**5. Los Antojitos del Barber** — (253) 402-6828
- see it: https://los-antojitos-del-barber-c4ffg.delivered.menu
- edit: https://www.quicksites.ai/admin/templates/9d77e35f-e9fc-4f20-8f99-3dc0332cd6b6

### The claim links are deliberately NOT in this file

⚠️ **A claim link is a bearer credential.** Whoever holds it takes ownership of that site — no
login, no verification (the SMS check is still behind `CLAIM_VERIFICATION_ENABLED`). It is not a
deep link, it is the key.

The first draft of this doc had all five pasted in, and **gitleaks refused the commit.** It was
right: five ownership-transfer tokens in a git repo, readable by anyone who ever clones it, is the
thing that scanner exists to stop. Worth recording because the tokens *look* like URLs, which is
how they would have gone in.

**Mint one at the moment you send it**, so it is fresh and lives only in the message:

```bash
npx tsx --env-file=.env.local -e "
import('./lib/auth/siteClaimToken').then(m =>
  console.log('https://delivered.menu/claim-site/<TEMPLATE_ID>?token=' + m.mintSiteClaimToken('<TEMPLATE_ID>')))"
```

The template id is the last path segment of the editor link above. Tokens expire after **30 days**
(`SITE_CLAIM_TTL_MS` in `lib/auth/siteClaimToken.ts` — this doc said ~90 for weeks, which would have
had someone reassuring an owner that a dead link was still good); a
refused link means minting a new one — never hand-edit the URL, the signature is bound to the id.

Send it **one-to-one to the business** and nowhere else.

Each page is watermarked and `noindex` until claimed. Printable QR codes are in `leads-renton-qr/`
(`<slug>.png` = owner claim · `<slug>-order.png` = the diner-facing order sticker).

## The five messages

⚠️ **These are drafts to re-read, not copy blocks to send.** Five pre-written messages in a file is
a template set — the thing this test exists to be the opposite of. What keeps them honest is that
each was built from a *different verified detail* (a Street View landmark, a menu quirk, a fact
about the business's shape), and none of those details came from our database. Before you send one,
open the draft and check the message is still true of it.

⚠️ **The links below are the corrected `https://deliveredmenu.com/<slug>` form.** The versions
actually sent on 2026-08-11 used the bare `<slug>.delivered.menu` hostname and **did not linkify** —
see "The link did not come through as a link" below. Never send a bare hostname on a new gTLD.

Each follows the same order for a reason: **I found you → here's what I made → here's what might be
wrong with it → here's why there's no catch.** The location line buys the credibility that makes
the next sentence land as care rather than sloppiness.

✅ **The download line is backed.** It was run end-to-end before these went out and took **seven
rounds** to actually work (#748–#754) — the early versions handed over our own 404, then a file with
zero embedded images and no error, then one that opened to an undismissable "Loading…" overlay.

**Verified (full):** the downloaded file opens offline with its images — **Enjoy Teriyaki only**.
**Verified (preconditions, all five):** each site serves its own business name on the menu host and
carries image references to inline — the two things the route 502s and silently no-ops on, and
where two of the seven failures lived. Checked 2026-08-11 against the live `?qs_export=1` render.
**Still unexercised:** the actual download for the other four. The route needs a session, so it
cannot be checked from a script — press it once per business before promising it to that owner.

---

### 1. Enjoy Teriyaki — (425) 793-7333

> Hi — this is Sandon, I'm local in Renton. I made a simple ordering page for Enjoy Teriyaki from
> your Google listing: https://deliveredmenu.com/enjoy-teriyaki-s7709
>
> You're in the strip with Pizza Dudes and Pike Place Bakery — took me a minute to find the right
> door. Your whole menu's on the page, but I pulled it off your listing photos, so the Chinese Wok
> and udon items are worth a 30-second look in case I got something wrong.
>
> It's free and it's yours. You can download the whole site from your dashboard any time and host
> it anywhere — if I get hit by a bus you keep it. And if you'd rather I take it down, say the word
> and it's gone today.

*Hook: 56 OCR'd items across 10 sections plausibly contain an error, and checking is useful to them.*

---

### 2. Taqueria Los Potrillos #5 — (206) 694-3872

> Hi — this is Sandon, I'm local in Renton. I made a simple ordering page for Taqueria Los
> Potrillos #5 from your Google listing: https://deliveredmenu.com/taqueria-los-potrillos-5-i3t57
>
> You're the one over by the Safeway on Sunset. Your whole menu's on there — 40-odd items — but I
> pulled it off your listing photos, so the combo plates are worth a quick look in case I got a
> price or a name wrong.
>
> It's free and it's yours. You can download the whole site from your dashboard any time and host
> it anywhere. If you'd rather I take it down, say the word and it's gone today.

⚠️ **Landmark is the Safeway, not Renton Deli — deliberately.** They are across the street from each
other and both are on this list. If two neighbours compare notes and each message names the other,
the personal touch inverts into a sweep of the block. **Send these two days apart.**

---

### 3. Renton Deli — (425) 226-7572

> Hi — this is Sandon, I'm local in Renton. I made a simple ordering page for Renton Deli from your
> Google listing: https://deliveredmenu.com/renton-deli-4edah
>
> You're the one between el Recreo and #1 Nail Pro — took me a minute to find the right unit. One
> thing I noticed: your sandwiches are listed B1 through B6 and the page never says bánh mì
> anywhere, so anyone searching that won't find you. Easy fix if you want it.
>
> It's free and it's yours. You can download the whole site from your dashboard any time and host
> it anywhere. If you'd rather I take it down, say the word and it's gone today.

*The strongest hook of the five: it offers something they are losing right now rather than
apologising for a possible mistake. Verified — `bánh mì` appears nowhere in their page data, while
"Vietnamese Sausage" does, so the observation is about our page rather than a guess about their
food.*

---

### 4. Los Antojitos del Barber — (253) 402-6828

> Hola — this is Sandon, I'm local in Renton. I made a simple page for Los Antojitos del Barber
> from your Google listing: https://deliveredmenu.com/los-antojitos-del-barber-c4ffg
>
> Took me a minute to find you — you're over by M & A Barber & Beauty on S 2nd. Fair warning, I
> built the page like a restaurant and you're really a dessert counter, so the fresas con crema and
> bubble waffles are on there but it may fit you a bit wrong. Tell me what's off and I'll fix it,
> or I'll take it down.
>
> It's free either way and it's yours — you can download the whole thing from your dashboard and
> host it anywhere. Not selling you anything.

⚠️ **"over by"** — not "inside", not "next to". Street View showed *in or near* the salon, and this
phrasing is true under both readings. Same discipline as holding HabitForge at 200,000+: pick the
version that is true under every reading you cannot rule out.

*Leads with what is wrong with our own work, which is the most unfakeable thing in any of these.*

---

### 5. Taqueria El 5 De Mayo — (253) 408-3302

> Hola — this is Sandon, I'm local in Renton. I made a simple ordering page for Taqueria El 5 De
> Mayo from your Google listing: https://deliveredmenu.com/taqueria-el-5-de-mayo-3cpt8
>
> The page lists 19044 108th Ave SE like a storefront, but you're the truck at the 76 station —
> nobody finds a truck from a street number. I can put "we're the truck at the 76 on 108th" right
> at the top so people know what they're looking for. Want me to?
>
> It's free either way and it's yours — you can download the whole thing from your dashboard and
> host it anywhere. Not selling you anything.

⚠️ **An earlier draft of this was wrong** and is worth remembering: it opened *"you're a truck, so
if you move around that page is telling people the wrong thing."* A truck parked at a fixed 76
station does not move — the address is right. Confidently wrong about someone's business in the
first line is worse than a generic message. The offer only became strong once the premise was
correct: from *"I'll remove something"* to *"I'll add the thing that gets you found."*

---

### What is deliberately NOT in any of them

- **No link to sandon.quicksites.ai.** It reads as a job-seeker's résumé, which to an owner
  choosing who to trust with their web presence says *he may not be here in six months* — the exact
  abandonment fear that makes "free" suspicious. The download line answers that fear instead, and
  it survives being true.
- **No "20+ years of experience."** They cannot check it and are not evaluating your seniority;
  they are deciding whether you are a scammer.
- **No claim link.** It is a bearer credential — whoever holds it takes the site. It goes in the
  *reply*, after a human answers, never in a first cold text.
- **No price for done-for-you work**, because there is not one yet. If someone asks, that is the
  most useful thing the five could tell us.

## What actually happened — sent 2026-08-11

⚠️ **All five went out the same day**, and the log was written afterwards from this file rather than
at the time. Both are deviations from the protocol below. Recorded here rather than quietly fixed,
because a pre-registered test whose deviations are only in someone's memory is no longer
pre-registered.

| what the protocol said | what happened | does it threaten the result |
|---|---|---|
| send Potrillos and Renton Deli **two days apart** | same day | **yes, for those two.** They are across the street from each other. If they compare notes, the personal approach reads as a sweep of the block — which is the *opposite* of the thing under test. Their replies are now entangled; a non-reply from either is weak evidence. |
| log verbatim **at the time of sending** | logged later, extracted from this file | mildly. The bodies are exact (pulled from this doc programmatically, not retyped), but the send *times* are recorded as a single approximate stamp. Day-level accuracy is what the reply-window measure needs, so this is survivable. |

The five bodies are now in `outreach_touches`, each linked to its template — visible at
`/admin/outreach-log`. Verified: 5 rows, 5/5 resolving to the right site.

**Claim links were correctly NOT sent** — see "What is deliberately NOT in any of them" below. Five
were minted on 2026-08-11 (expire 2026-09-10) and are held locally, out of the repo, for use in a
reply. Verified against production before being relied on: a good token renders the claim page, a
corrupted one returns "expired", so the locally-signed tokens really are accepted by prod.

---

## ⚠️ The link did not come through as a link — corrected 2026-08-11

**The single most damaging thing in this test so far, and it was in the drafts above, not the code.**
The messages carried the bare hostname `<slug>.delivered.menu`. Phones do not linkify `.menu` —
autolinking is driven by a TLD list, and the new gTLDs are not on it. So the one thing the entire
message exists to deliver arrived as plain text.

A screenshot of the sent message (Taqueria El 5 De Mayo, RCS on Android) shows it is worse than
untappable:

| what it looked like | what it was |
|---|---|
| `taqueria-el-5-de-mayo-3cpt8.delivered.menu` — **bold, not a link** | the site. Not tappable. |
| "5 De Mayo" — *underlined* | detected as a **date** |
| "19044 108th Ave SE" — *underlined* | detected as an **address** → opens Maps |

**Three tappable-looking things, none of them the site** — and the two that *were* tappable led to a
calendar entry and to the street address the message was arguing is misleading. The likeliest action
a recipient took was opening Maps to their own storefront.

The domain also hyphen-wrapped across four lines (`…deliv-` / `ered.menu`), so retyping it correctly
means noticing that two of the hyphens are real and one is not.

### The fix: use the .com we already own

`deliveredmenu.com` 301s to `delivered.menu` **preserving the path**, so every draft has a fully
tappable equivalent. Verified 2026-08-11 — all five return 200 with the right business name:

| business | tappable link |
|---|---|
| Enjoy Teriyaki | `https://deliveredmenu.com/enjoy-teriyaki-s7709` |
| Taqueria Los Potrillos #5 | `https://deliveredmenu.com/taqueria-los-potrillos-5-i3t57` |
| Renton Deli | `https://deliveredmenu.com/renton-deli-4edah` |
| Taqueria El 5 De Mayo | `https://deliveredmenu.com/taqueria-el-5-de-mayo-3cpt8` |
| Los Antojitos del Barber | `https://deliveredmenu.com/los-antojitos-del-barber-c4ffg` |

⚠️ **Both halves are load-bearing.** The `.com` gets it linkified; the explicit `https://` is what
makes linkification reliable *regardless* of TLD. Ship both, always.

⚠️ **The code was never wrong** — `menuSiteUrl()` has always returned `https://…`, and the outreach
SMS sender uses a full URL. This was a hand-written doc artifact that went out five times. A rule
that lives only in a function does not protect the messages a human writes by hand.

### The follow-up (send once, to all five)

A correction is a legitimate second touch — it is not a nudge, and it is the reason to text again.
Keep it to one line and do not re-pitch; they already have the pitch.

> Sorry — that link came through as plain text on your end, not something you can tap. Here it is
> properly: https://deliveredmenu.com/<slug>

### What this does to the result

**It is a confound that can only produce a false negative**, and it must be stated before the
replies are counted:

- A silent business may have found the offer uninteresting, **or may simply never have seen the page.**
  Those are indistinguishable from the outside.
- So a **0–1 of 5** outcome no longer cleanly triggers the "stop building outreach tooling" rule from
  the decision rule above — it is contaminated.
- A **4–5 of 5** outcome is *strengthened*, since it happened despite a broken first link.
- ✅ **The window did not have to move.** The correction went out the same day (2026-08-11), so the
  pre-registered 7-day timebox still expires **2026-08-18**. Worth stating because "reset the clock"
  was the recommendation an hour earlier and it stopped being true — a stale mitigation is its own
  small version of the failure this doc is about.

⚠️ **Every business now has two touches, not one.** That is a real change to what is being measured:
the test was designed around *one* message, and a second one — even a one-line correction — is a
second chance to be noticed. It is the right call (the alternative was measuring a broken delivery),
but a reply cannot afterwards be credited purely to the first message's craft.

Recorded rather than absorbed, because the pre-registered rule only means something if the
conditions it was registered under are the ones that actually held.

---

## Batch 2 — the clean-link arm (2026-08-12)

⚠️ **This is a DEVIATION from the decision rule, run deliberately and for a stated reason.** The rule
said send five more only after seeing 2–3 replies. Batch 1's window has not closed. But batch 1's
link did not linkify, so it now measures *"a broken link plus a same-day correction"* rather than
*"one good message"* — a question it can no longer answer. Batch 2 sends the working link from the
first word, which is the only way to get a clean read. Recorded here so a later reader does not
mistake it for the pre-registered follow-up it is not.

Batch 2 is **one touch, tappable `.com` link, no correction owed.** Compare against batch 1 knowing
batch 1 got two touches.

### ⚠️ The inventory is nearly gone, and it looks bigger than it is

26 unclaimed listing_import drafts remain. **Only 7 are usable:**

| excluded | n | why |
|---|---|---|
| **placeholder menu** | **11** | the #738 class — an *invented* menu under a real business's name |
| no phone | 2 | nothing to text |
| menu too thin | 1 | 3 items |
| **usable** | **7** | |

**Never send one of the 11.** A page showing food a real restaurant does not serve, presented as
that restaurant's own page, is the worst thing this pipeline can produce.

✅ **Resolved 2026-08-12 (PR #766).** A Kent sweep made 17 more of these, which forced the question
of why they existed at all: `assembleDraft` only *replaced* the scaffold's menu when a real one was
recovered. #738 had stopped them being **listed** in the city index — but their own pages still
served the invented dishes to anyone given the URL, which is exactly what outreach does. The
generator is fixed and all 28 were cleared. A filter downstream of a generator is not a fix for the
generator.

Also note only **one** usable draft is in Renton, so "I'm local in Renton" stops being a locality
claim about *them* and becomes one about *me*. Phrasing below reflects that; do not upgrade it.

### The five

| # | Business | Phone | Items | Verified hook |
|---|---|---|---|---|
| 1 | **My's Vietnamese Sandwiches and Deli** | (206) 772-1231 | 32 | 7 chè + a drinks list (pennywort, sugar cane, durian) nobody knows about |
| 2 | **Georgetown Shell Chicken & Deli** | (206) 767-6200 | 29 | chicken meals are `#1`–`#5` with no descriptions |
| 3 | **Teriyaki Avenue** | (206) 723-2489 | 34 | hours list every day **except Monday** |
| 4 | **Taqueria Jalisco** | (206) 771-9497 | 24 | **our parser priced all 24 items at $14** |
| 5 | **The Local 907** | (425) 255-2511 | 11 | only the **happy hour** menu came through |

Every hook was read off the draft or the live render on 2026-08-12, not remembered. Two of the five
lead with a flaw in *our* work, which was the strongest shape in batch 1.

---

### 1. My's Vietnamese Sandwiches and Deli — (206) 772-1231

> Hi — this is Sandon, I'm local, over in Renton on the same road as you. I made a simple ordering
> page for My's from your Google listing: https://deliveredmenu.com/my-s-vietnamese-sandwiches-and-deli-6hoik
>
> Your name says sandwiches, so what surprised me was the rest of it — seven chè and a drinks list
> with pennywort, sugar cane and durian. None of that shows up anywhere online, so nobody knows to
> come to you for it. It's all on the page now.
>
> I pulled it off your listing photos, so the spellings are worth a look in case I got one wrong.
> It's free and it's yours — you can download the whole site from your dashboard and host it
> anywhere. If you'd rather I take it down, say the word and it's gone today.

*12619 Renton Ave S — Renton Ave runs from Renton into Seattle, so "same road" is literal and
checkable. 15 bánh mì all at one price; the chè and drinks are the part no listing shows.*

---

### 2. Georgetown Shell Chicken & Deli — (206) 767-6200

> Hi — this is Sandon, I'm local, over in Renton. I made a simple ordering page for the deli at the
> Georgetown Shell from your Google listing: https://deliveredmenu.com/georgetown-shell-chicken-deli-nvlzr
>
> One thing I noticed: your chicken meals come through as #1 through #5 with no description, so
> anyone who hasn't been in has no idea what #3 is. Tell me what's in them and I'll write them out —
> that's the difference between a regular ordering and a stranger not ordering.
>
> The rest came off your listing photos, so it's worth a quick look. It's free and it's yours —
> download the whole site from your dashboard any time and host it anywhere. If you'd rather I take
> it down, say the word.

*The batch-1 Renton Deli shape: offers something they are losing right now rather than apologising
for a possible mistake. Verified — the seven-section menu really does list `#1`…`#5` bare.*

---

### 3. Teriyaki Avenue — (206) 723-2489

> Hi — this is Sandon, I'm local, over in Renton. I made a simple ordering page for Teriyaki Avenue
> from your Google listing: https://deliveredmenu.com/teriyaki-avenue-li2tb
>
> All 34 items are on there. One thing to fix: your hours list Sunday and Tuesday through Saturday,
> and Monday just isn't there — so it reads like I made a mistake rather than like you're closed.
> Tell me which it is and I'll set it right.
>
> I left the prices off on purpose, since I couldn't confirm them off a photo — they say "call to
> confirm" until you tell me otherwise. It's free and it's yours; you can download the whole site
> from your dashboard and host it anywhere. If you'd rather I take it down, say the word.

*⚠️ Says "tell me which it is" rather than asserting they are closed Mondays. The page omits the
day; that is all we know. Same discipline as "over by" in batch 1.*

---

### 4. Taqueria Jalisco — (206) 771-9497

> Hola — this is Sandon, I'm local, over in Renton. I made a simple ordering page for Taqueria
> Jalisco from your Google listing: https://deliveredmenu.com/taqueria-jalisco-ys8g2
>
> Fair warning, I got something wrong. Reading your menu off photos, every single item came out at
> $14 — tacos, the ceviche, the burritos, all of it. That's obviously not right, so the page shows
> no prices at all right now, just "call to confirm." Send me the real ones and I'll put them in.
>
> The dishes and descriptions did come through properly, all 24 of them. It's free and it's yours —
> download the whole site from your dashboard any time and host it anywhere. Not selling you
> anything.

*Leads with our own error, the most unfakeable thing available. The claim is safe to make because
the freshness rule already suppresses the bad prices — the page a visitor sees says "call to
confirm", so the message describes the page accurately.*

---

### 5. The Local 907 — (425) 255-2511

> Hi — this is Sandon, I'm local in Renton. I made a simple page for The Local 907 from your Google
> listing: https://deliveredmenu.com/the-local-907-ljdit
>
> Fair warning on this one: the only menu I could pull off your listing photos was the happy hour,
> so the page currently makes it look like fried pickles and the pub burger are all you do. Send me
> a photo of the regular menu and I'll put it up properly.
>
> It's free either way and it's yours — you can download the whole thing from your dashboard and
> host it anywhere. If you'd rather I take it down, say the word and it's gone today.

*The only Renton business left in the inventory, so it carries the one unqualified locality line.
Verified: the live page renders a single section titled "Happy Hour" and nothing else.*

---

### ⚠️ A latent bug found while writing these — not visible, do not "fix" it in a panic

Every parsed price is stored with a doubled dollar sign (`"price": "$$8.95"`), on batch 1's sites too
(112 occurrences on Enjoy Teriyaki alone). **It reaches no visitor**: `menuFreshness` suppresses
undated prices, so the rendered page says "call to confirm" and the `$$` never renders. Confirmed by
reading `document.body.innerText` on the live pages — the raw HTML payload showed 112, the rendered
text showed **0**.

Worth fixing before any owner confirms prices, because that is the moment it becomes visible. Worth
recording because the payload and the render disagreed, and only one of them is the artifact.

---

## Protocol — per business, in order

1. **Open the draft and read it as the owner would.** Fix anything that is not true of their
   business. ⚠️ This is the step the pipeline cannot do and the whole reason for doing five by
   hand — the menu came off photos and OCR is confident when it is wrong.
2. **Rewrite at least one line in their voice**, from their own listing/reviews. Not our copy
   about them.
3. **Send one short personal message** to the phone on their listing. Drafts are above — ⚠️ read
   the one you are about to send against the actual draft first. They are written from verified
   details (a Street View landmark, a menu quirk), and a detail that has gone stale turns the whole
   effect inside out: a message that is confidently wrong about someone's business is worse than a
   generic one.
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
