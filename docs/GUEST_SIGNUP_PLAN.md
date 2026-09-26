# Guest build → sign-up: the path is broken, and the plan to fix it

> Handoff for the next session. Written 2026-09-13 after the owner asked *"are we making it easy
> enough for them to sign up after they've made a trial site?"* The answer was no, with numbers.
> Re-derive the numbers on `/admin/ops` ("Guest builders → sign-ups"); never trust the ones here.

## ⛔ RE-MEASURED 2026-09-25 — the fix could not be evaluated, because the funnel emitted nothing

Twelve days after PR A, against the live DB:

| | |
|---|---|
| guest sites · builders | **52 · 21** |
| published · converted | **0 · 0** — every site still owned by an `is_anonymous` user |
| builders since the 09-13 fix | **8**, of whom **0** converted |
| of those 8, time invested | one spent **95 minutes**, another **45** |

⚠️ **NOBODY HAS EVER SUBMITTED THE FORM.** Across the 21 anonymous owners: `email` = 0,
`email_change` (a pending confirm) = 0, `encrypted_password` = 0. So the confirmation-link token
shape — the thing the owed browser walk-through exists to test, and "the one thing a test cannot
see" — **is not the binding constraint. Nobody reaches it.**

⚠️ **And "0 of 8" was uninterpretable, because everything before the form was dark:**

1. `guest_upgrade_events` had 0 rows and **structurally could not have had any**: its only writer,
   `components/admin/modals/upgrade-modal.tsx`, was **imported nowhere.** A table with a schema, an
   admin reader and a dead writer reads exactly like instrumentation.
2. The UI that actually shipped in PR A (`guest-signup-box.tsx`, `guest-publish-banner.tsx`) emitted
   **no events at all.**
3. ✅ The confirm side was fine — `captureGuestConversionIfFresh` fires `GUEST_SIGNUP_CONFIRMED` on
   **both** auth branches. It has never fired because nobody has confirmed, which is a *correct*
   silence. ⚠️ Worth recording how this was nearly misread: a grep for the literal string
   `guest_signup_confirmed` finds only `events.ts` and its test, because every call site uses the
   **symbol**. Searching for the string and concluding "no call site" is a one-character mistake
   with an opposite conclusion.

**So an empty table meant "nobody logged it", not "nobody clicked" — and until you know which, the
next fix is a blind shot.** That is why instrumentation preceded any further change to the UI.

### Shipped 2026-09-26 (PR D) — a lighter ask, behind the flag

⚠️ **The measured problem is not which method people pick — it is that 21 of 21 never typed an
email.** The password path asks for an address, an invented password, and a trip to an inbox
before the site they just built can go live. Google asks for one tap.

- `GuestSignupForm` gains **Continue with Google**, rendered FIRST (below the form would leave the
  heavy ask as the default and test nothing).
- ⚠️ **`linkIdentity`, NOT `signInWithOAuth`.** `/login` can use `signInWithOAuth` because nobody
  there has anything to lose. Here it would start a NEW session under a NEW uid and **orphan the
  draft** — the same failure as sending them to `/login`, wearing a nicer button. It would also
  look completely correct in review, because it is what the `/login` button does two files away.
  Pinned by a test that fails on `signInWithOAuth` appearing in this component at all.
- Every funnel step now carries a **`method`** (`password` | `google`), folded into
  `trigger_reason` as `surface:method:reason`. Without it the button would be unmeasurable, and
  shipping it unmeasured is how you end up believing it helped.

⛔ **INERT until two Supabase dashboard actions.** Verified 2026-09-26: the authorize endpoint
returns `{"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`.
So the flag being off is correct, not an oversight — turning it on today renders a button that
400s.

**Owner actions, in order:**
1. Supabase → Authentication → Providers → **Google**: client id + secret.
2. Supabase → Authentication → **Manual linking: enabled** (required by `linkIdentity`).
3. Supabase → URL Configuration → Redirect URLs: allowlist the app hosts.
4. `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1` in Vercel, then **redeploy** — it is build-time inlined.

⚠️ **Assumed, not measured:** that one-tap sign-up converts better here. It is a strong prior and
it is not evidence; the `method` dimension exists precisely so the claim can be checked rather
than believed.

### Shipped 2026-09-25 (PR C)

- `lib/analytics/guestFunnel.ts` — six pre-submit steps: `prompt_shown` (the **denominator**),
  `signup_opened`, `signup_submitted`, `signup_email_sent`, `signup_failed`,
  `signup_existing_account`; each tagged with the surface (`banner` · `banner_inline` · `toolbar` ·
  `publish` · `modal`). `publish` is the strong one — it means they tried to publish and were refused.
- `POST /api/guest/funnel` — ⚠️ **server-side with the service role, not a client insert.**
  `guest_upgrade_events` currently has RLS *disabled*, so a browser insert's fate depends on table
  GRANTs, and a later hardening sweep (this repo has locked a batch of anon-writable tables before)
  would make it fail **silently** — building a silent-failure mode into the instrument whose whole
  job is to end one. The user id comes from the session, never the body.
- ⚠️ **No PII by construction.** The unit is a STEP, not a person: no email, no password, and never
  the provider's error string (Supabase puts the address in some of them) — failures are one of
  three coarse reasons. Guarded by tests over the source.
- `signup_submitted` fires **before** password validation, so someone our own rule turns away still
  counts as having tried.
- `/admin/ops` gains a "Before the form — where they actually stop" row. ⚠️ Unread events render as
  **"—", never 0**; only a successful read of an empty table may say zero.
- The dead `upgrade-modal.tsx` is **deleted**, so nothing looks instrumented that is not.
- `test/stripComments.ts` — shared, because a source guard that greps prose fails on the comment
  explaining the rule. That happened three times in one day here, then twice more the same
  afternoon. Also fixed the `@/test/*` path alias, which existed for `tests/` (Playwright) but not
  `test/` — so the import resolved under Jest and failed under `tsc`.

**Verified:** a service-role insert through PostgREST returns 201 and the row lands with the right
columns (self-test row written and deleted); the route answers 401 unauthenticated and 400 on an
unknown event, against a real build.
**Still owed, and now narrower:** the browser walk-through. It answers "if someone clicks, does the
path complete" — a different question from "do they ever click", which the events will now answer.

---

## The numbers (live DB, 2026-09-13, guests since 2026-07-03)

| Stage | Count |
|---|---|
| Guest sessions (anonymous auth users) | 22 |
| Guest-built sites | 47, by 16 builders |
| Guests who edited a site 10+ minutes | 7 |
| Guests who signed in again later | **0** |
| Guests who typed an email into the sign-up box (pending `new_email`) | **0** |
| Converted | **0** |

Seven people invested real time. Not one took the next step. **That is a path problem, not a
demand problem** — and the mechanism itself works: an anonymous session upgraded in place with
`updateUser({ email })` succeeds against production auth (probed 2026-09-13, probe user deleted).

## What a guest actually hits, in order

1. **The sign-up banner (`components/admin/guest-publish-banner.tsx`) sits at the top of the
   editor and scrolls out of view.** The always-visible bottom toolbar says *"yours when you sign
   up"* as text — no button. A persona tester reported exactly this doubt *after* customizing;
   the fix that shipped (#… "the guest suffix") changed the wording, not the missing control.
2. **Pressing Publish shows "Failed to publish."** `TemplateActionToolbar.onPublish` →
   `publishSnapshot` → `GET /api/admin/sites/publish`, which is `requireAdmin()`. A guest gets a
   generic error at the exact moment of intent, with no sign-up path. ⚠️ **This is not
   guest-specific**: any non-admin owner gets the same failure. The route that returns a proper
   `needs_signup` code (`app/api/templates/[id]/publish`) has zero callers.
   *Assumed, not clicked:* a signed-up non-admin hits the same wall. The gate makes it near-certain.
3. **The confirmation email lands on the homepage, not their site.** The banner's
   `updateUser({ email })` passes no `emailRedirectTo`, so Supabase sends the confirm link to the
   Site URL. `app/auth/callback` handles the PKCE `code` and magic-link fragment flows; the
   email-change verify redirect lands on `/`. The banner copy says *"then come back to publish"*
   and offers no way back. Their session lives in one browser; on a phone — where most people
   open email — there is no site to come back to.
4. **An upgraded guest has an email but no password.** On a second device the only way in is the
   magic-link option on `/login`, which they were never told exists.

## Status — steps 1–4 SHIPPED 2026-09-13 (PR A)

- **1 ✓** `Sign up to publish` button in the always-visible bottom toolbar; a refused Publish opens
  the same box (`publishSnapshot` maps `needs_signup` → `GUEST_SIGNUP_EVENT`; `GuestSignupModal`
  is mounted in the guest shell). One form (`components/admin/guest-signup-box.tsx`), reused by
  the banner.
- **2 ✓** `/api/admin/sites/publish` gates on `requireTemplateOwner` (admin bypass kept); an
  anonymous owner gets `401 needs_signup`. Any signed-up owner can publish their own site.
- **3 ✓** `updateUser({ email, password }, { emailRedirectTo: /auth/callback?next=<editor> })` —
  the confirmation lands in their editor; the callback's fragment branch finalises on any device.
- **4 ✓** A password is collected in the same form, so a second device can log in normally.
- **5 ✓** PostHog `guest_signup_confirmed` (`lib/analytics/guestConversion.ts`) fires from both
  auth landing routes when a confirmed user's account predates the confirmation AND owns a
  `guest_build` template. ⚠️ `SIGNUP` never fires for a converted guest — it keys on account age
  — so any funnel that counts sign-ups must include this event. "Started" is not an event: the
  ops panel reads it from `auth.users.new_email` (pending confirmation), which is the truth.
- **Verification still owed (a person, in a browser):** incognito → `/build` → edit → press
  Publish → box opens → sign up → confirm from a *different* browser → land in the editor →
  Publish succeeds → `/admin/ops` shows `startedSignup` and `converted` move. The email template
  is Supabase's default "Confirm email change"; if its link does not carry the tokens in the
  fragment, the callback will send them to `/login?error=missing_tokens` — that is the one thing
  a unit test cannot see.

## The plan (one PR, in this order)

1. **Put "Sign up to publish" in the bottom toolbar** (`TemplateActionToolbar`, `fixed bottom-4`,
   the one element always on screen) and make **Publish itself open the sign-up box for a guest**
   instead of calling the route. Reuse the banner's email form (extract it into a shared
   `GuestSignupBox`); keep the banner.
2. **Make Publish work for owners, not just admins.** Gate `/api/admin/sites/publish` (or a new
   `/api/templates/[id]/publish` that the toolbar actually calls) on `requireTemplateOwner` with
   an admin bypass. Keep the `needs_signup` 401 for anonymous owners and have the toolbar map it to
   the sign-up box rather than "Failed to publish". Pin with a test that the toolbar's publish call
   handles `code === 'needs_signup'`.
3. **Send the confirmation link back to their editor.** `updateUser({ email }, { emailRedirectTo:
   `${origin}/auth/callback?next=/admin/templates/<id>` })`, and make `/auth/callback` finalize the
   email-change token flow (it arrives as a fragment, like the magic link — Case B already handles
   that shape). Landing = their site, Publish enabled.
4. **Give them a way in on another device.** Either collect a password in the sign-up box
   (`updateUser({ email, password })` in one call) or show *"we'll email you a sign-in link any
   time — no password"* and make `/login` default to magic link for an address with no password.
5. **Measure.** The ops panel already shows the funnel; add a PostHog `guest_signup_started` /
   `guest_signup_confirmed` pair in `lib/analytics/events.ts` at the two transitions.

Verification for the PR: build as a guest in an incognito window → edit → press Publish → sign-up
box → confirm from a *different* browser → land in the editor → Publish succeeds → the site is
live. Then read `/admin/ops`: `startedSignup` and `converted` must move.

## Reaching the 16 who already left

`npm run guests:contacts` lists every guest site with what it recorded (business name, phone,
email — **flagging `hello@<slug>.com`, which is OUR placeholder from `autogenerateForTemplate`,
not theirs**) and, where the site was rebuilt from a URL, what that website's homepage and
contact page show. Today: 3 sites have a source URL (Adze Media, RefReady, Meddzelle), 2 carry a
scraped phone, the rest are a business name only. The script finds people; **a person writes the
apology** — the same rule as `outreach:candidates`.

## PR B — SHIPPED 2026-09-13: the "Reachable" tile on /admin/ops expands into the outreach panel

Click **Reachable** → every guest site with what it recorded, what its source website shows
(button, free), and a Places candidate by name (button, paid, CONFIRM only). Per row: **Email**
(`mailto:` with a subject and no body), **Text** (`sms:`, no body), **Postcard** (a form prefilled
from the candidate that the operator checks; Preview / Mail test card / Mail to this address; one
card per click, `window.confirm`, real key only). The tracked link is `/go/guest/<templateId>`
(`app/go/guest/[templateId]/route.ts`): mints the claim cookie server-side from the row's anon
owner and sends the visitor to sign up with their editor as `next`; once the owner has an email the
same link goes to the site. Card copy: `lib/outreach/guestApologyCard.ts`, pinned by the same
forbidden-promise test as the claim card plus "it must say THEY built it". Same rows in the
terminal: `npm run guests:contacts` (both call `lib/admin/guestLeads.ts`).
⚠️ Still a person's call per row: a guest site records no city, so a candidate is a guess until you
say otherwise; name-only builders with no listing get no card.

## PR B — original spec (owner asked 2026-09-13)

`npm run guests:contacts -- --lookup` adds a Google Places candidate (address · phone · website)
per name-only site, tagged **CONFIRM** with a name-similarity score. ⚠️ A guest site records no
city, so the candidate is a guess until a person confirms it by eye; names with nothing
distinctive ("pepe", "real estate", "Smoothie Shop") are skipped, not guessed. Postage to the
wrong "Joe's Bakery" is the invented-menu class with a stamp on it.

What the card needs that does not exist yet:

1. **A tracked, bearer-free link for a guest draft** — `app/go/guest/[templateId]/route.ts`,
   modelled on `app/go/[prospectId]` (the trade card's QR). The 30-minute `mintClaimToken` needs
   the guest's *own* session, so a printed QR cannot carry it. The route instead: counts the visit,
   reads the template's anonymous `owner_id` server-side, sets the `qs_pending_claim` cookie for
   `{ templateId, anonUid }`, and 302s to `/login?next=/admin/templates/<id>` — so after sign-up
   on ANY device, `claimPendingGuestDraft` transfers the site (the RPC only moves a row still
   owned by that anon uid, so it is safe and idempotent). Once claimed, the same link goes to
   the live site (a card lands a week later).
2. **A card that apologises and promises nothing** — `lib/outreach/guestApologyCard.ts`, front:
   *"You built &lt;name&gt; a website with us. Our sign-up step was broken — that was our fault.
   It's still yours."* + the site host + QR; back: what happened in two sentences, the exit line,
   the sender sign-off + the Calendly line. Run it through the same FORBIDDEN-promise test as the
   claim card (no ranking / 24/7 / licensing / guarantee / competitor / deadline / price).
3. **A confirm-gated send** — a `--to <templateId>=<candidate placeId>` list the operator types
   after reading the CONFIRM rows; the script builds the Lob address from the candidate,
   preflights the site URL (must answer 200), and mails through `sendPostcard` with
   `lobKeyIsTest` refused. Never a bulk "mail all candidates".

Owner decision before PR B: whether a postcard is the right channel for people who typed only a
business name (a shop with a Places listing gets a card at its counter; a person building a
personal or side-project site may have no listing at all — "Poignant Photography",
"Doggie Doo Pickup").

## Owner decisions still open
- Whether to collect a password at sign-up or go magic-link-only (plan step 4).
- Whether to search the name-only guests by business name (the script deliberately does not).
