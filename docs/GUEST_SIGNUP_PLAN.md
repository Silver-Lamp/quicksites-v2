# Guest build → sign-up: the path is broken, and the plan to fix it

> Handoff for the next session. Written 2026-09-13 after the owner asked *"are we making it easy
> enough for them to sign up after they've made a trial site?"* The answer was no, with numbers.
> Re-derive the numbers on `/admin/ops` ("Guest builders → sign-ups"); never trust the ones here.

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

## PR B — the apology postcard with a QR to their site (owner asked 2026-09-13)

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
