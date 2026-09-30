# Call cascade — "we'll keep ringing until someone picks up"

**Status: PLAN, nothing built.** Written 2026-09-30 for an owner decision. Supersedes nothing;
the single-destination forward in `docs/PPL_VERTICAL.md` §9 stays until this replaces it.

---

## 1. The problem, measured today

`covingtontow.com` took two real inbound calls at 07:33 and 07:34 PT. Both rang out. The
destination was AL Ram Towing — 5.0★ from 71 reviews, 0.6 km from the town centre, the
highest-scoring business in the market by a clear margin.

We re-pointed to Prime Towing and tested it. **That went to voicemail too** — and through our
bridge it produced a 3-second `dial-completed` with three SIT beeps, so the caller got nothing
at all.

**Two destinations, two failures, chosen independently.** The working hypothesis is no longer
"we picked a bad business." It is that **a tow operator is driving a truck and does not answer
an unknown number**, which makes single-destination forwarding the wrong mechanism for this
trade regardless of who is on the other end. `forward_unresponsive` would eventually swallow
every business in the market, one honest observation at a time.

⚠️ **And when the dial fails, we drop the caller in silence.** `<Dial action>` hands off to
`/api/twilio-callback`, which returns an empty `<Response/>` — which tells Twilio to hang up.
There is no fallback. The caller hears *"please hold while we connect you"*, then ringing, then
nothing. Confirmed live by the operator on 2026-09-30. **This part is ours and is a defect
whatever else we decide.**

## 2. What changes

Instead of *forwarding a call to one business*, we **work the caller's request until a business
takes it**:

1. Caller rings the tracking number.
2. We tell them, honestly, what is about to happen.
3. We ring local businesses **one at a time**, in order of who actually answers.
4. Each one hears a whisper and must **press 1 to take the call**.
5. First to accept is bridged to the caller.
6. If nobody accepts, we say so plainly and take a message.

⚠️ **This is a hunt group, not a lead marketplace, and the distinction is load-bearing rather
than cosmetic. Nothing is transmitted except a phone call.** No recording is redistributed, no
caller phone number is sent to anybody who did not answer, no data leaves us. That is what
separates it from lead brokering, it is what sidesteps the two-party-consent question below,
and it stops being true the moment someone adds "and text the details to the runners-up."

## 3. Why the accept keypress is the whole design

⚠️ **Without it, voicemail eats the lead, and that is exactly the failure we just watched.**
Twilio counts a voicemail pickup as an answer. So a naive cascade dials Prime Towing, Prime's
voicemail answers in 3 seconds, the cascade stops, and we bridge a stranded driver to a greeting
— today's bug with more steps and a bigger bill.

Requiring a digit makes the difference machine-readable: a voicemail cannot press 1. A leg that
does not press is treated as unaccepted and the cascade moves on.

⚠️ Acceptance must be recorded **server-side**, not inferred from `DialCallStatus`. A rejected
leg and a short real conversation both surface as `completed` with a small duration, and the
whole point is that we have already been burned by reading `completed` as "a person took this
call." The whisper's `<Gather>` action writes the acceptance; the dial action reads it.

## 4. Copy — what we may and may not say

The owner's phrasing was *"we'll keep dialing for you until we get you a response."* ⚠️ **That
is a promise we cannot keep.** We try a finite list and will sometimes reach nobody. A service
that advertises "until" and quietly gives up after five attempts is the failure class this repo
keeps rediscovering.

| Moment | What it may say |
|---|---|
| Greeting | "Thanks for calling. I'll ring local towing companies until one picks up — stay on the line." |
| Between attempts | "Still looking — hold on." |
| Nobody accepted | "I couldn't reach anyone right now. Leave a message and I'll pass it on, or try again shortly." |
| Whisper to business | "Customer calling for towing in Covington from covingtontow.com. Press 1 to take the call." |

⚠️ **Never imply the businesses are vetted, licensed, insured, partnered, screened or "our
network."** They are none of those things — most have never spoken to us. `FORBIDDEN_IVR_PHRASES`
(`lib/ppl/ivr.ts`) already bans the worst of these and must cover the cascade copy too, grepped
in tests like the rest.

⚠️ **Say "I" or "QuickSites", never imply the caller reached the business.** A caller who thinks
they are talking to a tow company and gets a different one is a bait-and-switch, however
convenient.

## 5. Consent — the open gap on the business side

The forwarding notice we sent says *"calls that come in to `<domain>` are being forwarded to you
at no charge… reply STOP."* That covers **being the designated destination**. It does **not**
cover being cold-dialed as one of thirty candidates with a live customer on the line.

Required before any cascade dials a non-designated business:

- A **new notice** to each business entering a cascade pool, saying what it is, and that pressing
  1 is what accepts a call. One per business, not per call.
- **STOP honoured** — `forward_opt_outs` already exists and is already read by the recommender.
- ⚠️ **First contact must not be the cascade itself.** A business whose first knowledge of us is
  an unexpected call with a stranger attached is a complaint, not a lead.

**Legal question I cannot answer and did not:** whether a caller hearing "this call may be
recorded" covers recording a cascade in a two-party-consent state (WA) when the eventual callee
is undetermined at the moment of the notice. The conservative build **does not record the
bridged leg at all** and loses nothing we currently use.

## 6. What it costs

Twilio list prices at time of writing — ⚠️ **unverified against an actual bill; check before
trusting**:

| Item | ~Price |
|---|---|
| Inbound to a local number | $0.0085/min |
| Outbound to a US local number | $0.014/min |
| Number rental | $1.15/month |
| SMS | ~$0.008 + carrier fees |

A cascade call with five attempts at ~22 s each ≈ 2 min of outbound plus the caller's inbound
leg. **Roughly $0.05–$0.08 per cascaded call.**

⚠️ **Set against real volume, this is noise, and that is the more important number.** Across all
**12** campaigns holding a tracking number, `call_logs` holds **12 calls total since
2026-09-19** — most of them the owner's own tests, with **two** genuine inbound calls ever. At
that rate the cascade costs a few cents a month. Cost only becomes a question if this works, and
that is a good problem.

Candidate depth per live campaign (towing/electrical prospects within the trade radius, with a
phone): **42, 40, 39, 33, 32, 30, 28, 16, 11, 10, 9, 5.** Ample for a 5-deep cascade everywhere
except `arab-towing.com`.

## 7. Build

**Phase 0 — stop dropping callers (ship regardless, ~half a day).**
The silence fix on its own: an unanswered dial takes a message instead of hanging up, and the
designated business is texted that a call came in and was missed, with the caller's number.
Valuable whether or not the cascade is ever built, and it is the terminal fallback of the
cascade anyway.

**Phase 1 — the cascade (~2 days).**
- `cascade_attempts` table: one row per (call, business, outcome). This is the state machine's
  memory **and** the measurement — attempts-to-answer is the number that says whether this works.
- `lib/ppl/cascade.ts` — pure: given a campaign and the answer history, produce the ordered list
  and decide the next attempt. Testable without Twilio.
- Ordering reuses `forwardHealth`: businesses that actually answer go first. ⚠️ This is the
  unresponsive data earning its keep as a **ranking** rather than a blacklist — a better use, and
  it retires the concern that the blacklist eventually eats the market.
- Twilio routes: greeting → attempt N → whisper/accept → bridge or advance → exhausted.
- Caller-facing and business-facing copy, with the forbidden-phrase test extended.

**Phase 2 — the business notice (~half a day, but gated on Phase 1 copy being settled).**
One-time SMS to each business in a cascade pool, STOP honoured.

**Not in scope:** paying businesses, charging businesses, any callback-later flow, any
redistribution of recordings or caller numbers to businesses that did not answer.

## 8. How we would know, and what would falsify it

The two numbers that decide it, neither of which we can guess:

1. **Do callers hold?** Each attempt is 20–25 s, so a 3-deep cascade is over a minute. If callers
   hang up at attempt 2, the whole idea fails and we should know within ten real calls.
2. **Does anyone press 1?** A business that ignores an unknown number may equally ignore a
   whisper. If nobody accepts across a full pool, the problem is not routing and no amount of
   cascade depth fixes it.

⚠️ **We currently have two real inbound calls in the entire history of the product**, so neither
number can be estimated from what we hold — only measured after shipping. Both are recorded by
`cascade_attempts` by construction.

⚠️ **The honest failure mode to watch for:** a cascade that reaches nobody looks, to the caller,
exactly like today's silence but after ninety seconds of hold. If attempts-to-answer runs long
and acceptance stays at zero, **shipping Phase 0 alone is the better product** and the cascade
should be pulled rather than tuned.

## 9. Decisions for the owner

1. **Cascade depth** — how many businesses before we stop. Suggest 5.
2. **Ring time per attempt** — suggest 22 s. Longer reaches more people and loses more callers.
3. **Record the bridged leg?** Suggest **no** for now; it removes the consent question entirely
   and nothing currently consumes the recordings.
4. **Ship Phase 0 first, or wait and ship the cascade whole?** Suggest Phase 0 now — callers are
   being dropped in silence today, and it is the cascade's fallback regardless.

---

## 10. Built 2026-09-30

**Phase 0 — shipped (#1073).** An unanswered forward takes a message and texts the business the
callback number. `/voicemail/<token>` streams the audio with our credentials (a raw
`api.twilio.com` recording URL 401s, so texting one sends a link that looks delivered and plays
nothing). The bridged leg is no longer recorded, per §9.3 — and the consent obligation **moved**
to the voicemail prompt rather than being dropped, which discloses more than the notice it
replaced: the caller is told the message is kept *and* where it goes.

**Phase 1 — built, flag-gated OFF (`CALL_CASCADE_ENABLED`).** Pure logic in `lib/ppl/cascade.ts`,
I/O in `cascadeStore.ts`, state in `cascade_attempts` (migration `20260864`). The loop is five
Twilio routes under `/api/twilio/geo/[campaignId]/`: `cascade` (pick and ring), `whisper` (the
accept Gather), `accept` (the keypress), `cascade-leg` (outcome, then advance), `voicemail`
(terminal fallback, shared with Phase 0).

Settled at the owner's answers to §9: depth **5**, ring **22 s**, **no** recording of the
bridged leg, Phase 0 first.

### What the build changed about the plan

⚠️ **`getGeoCampaign()` does not return `center_lat`/`center_lon`.** Passing its result to the
pool loader — the obvious thing to write, and what the first draft did — makes `marketMatch`
find no coordinates and silently fall back to **city-name equality**, which is the bug distance
matching exists to kill: `outreach_prospects.city` records where a business was first swept, not
which town it serves, and it qualified **1 of 13** real candidates in Maple Valley. The cascade
would have rung one business in a market holding thirty-three and nothing would have looked
broken. `loadCascadePool` now takes a campaign **id** and loads the columns it needs itself, so
no caller can hand it the wrong shape.

⚠️ **Unresponsive businesses are ordered last, not excluded.** In a cascade the distinction
matters: ringing a business that has never picked up costs 22 seconds and might work, while
striking it off shrinks a thin market permanently. A STOP still excludes absolutely — that is
the business's own decision, not our observation. **This is `forward_unresponsive` doing a
better job than it did as a blacklist**, and it retires the worry in §1 that the list would
eventually swallow the market.

⚠️ **Unknown sorts between known-good and known-bad.** Last means a freshly-swept market never
gets rung; first means one lucky answer outranks a business with a real record. Most of any pool
is unknown at any moment.

⚠️ **`I tried 0 and couldn't reach anyone`** was the first draft's output on an empty pool — a
machine reading a variable aloud, and a claim about attempts that never happened. An empty
market is a real state and gets its own sentence.

## 11. Before turning the flag on

1. **A business notice** (phase 2, not built). The forwarding notice covers *being the
   designated destination*. It does not cover being cold-dialed as one of thirty candidates with
   a live customer attached. ⚠️ **A business whose first knowledge of us is an unexpected call
   with a stranger on the line is a complaint, not a lead.**
2. **One end-to-end call on a real campaign**, watching `cascade_attempts` fill.
3. Then the two numbers in §8 — attempts-per-call, and whether `accepted` is ever true.
