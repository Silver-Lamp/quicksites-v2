# Italy restaurant demo — table booking (Step 1, demo-grade)

> Status 2026-10-14: **built, demo site published.** Owner GO relayed by HiveJournal on
> 2026-10-14 (crosstalk `20261014-154550`): a *demo of Step 1* to win the deal, no real guest
> data, no billing. Split: **QuickSites builds the booking** (this doc); **HiveJournal builds the
> visual floor plan + the food-cost calculator**, keying tables on our `restaurant_tables.id`.
> Pricing and the proposal itself live on HJ's `/for-italy` page and are the owner's.

## What it is

A restaurant site with a `table_booking` block: a guest picks a **day → number of guests → time
→ name / phone / email** and gets a confirmation; the owner has a **phone page** (tonight,
tomorrow, add a phone booking, cancel). Every word is Italian when the site says so.

Demo: `https://www.quicksites.ai/sites/trattoria-del-borgo-demo` (fictional trattoria, San
Gimignano; `claim_source='demo_seed'`, `meta.is_demo`, `meta.demo_kind='italy_table_booking'`;
no hero image, so no generated people). Owner page: `/merchant/bookings/<templateId>` (sidebar →
Customers → Bookings).

## Where it lives

| Piece | Path |
|---|---|
| Schema | `supabase/migrations/20260884_table_bookings.sql` — `restaurant_tables`, `table_bookings`, **exclusion constraint** `(table_id, tstzrange(starts_at, ends_at)) WHERE status <> 'cancelled'`, deny-default RLS (service role only) |
| Rules | `lib/booking/settings.ts` — `data.meta.booking` `{tz, windows{mon..sun:[{open,close}]}, seating_minutes 90, slot_minutes 15, lead_minutes 60, max_party 8, closed_dates[], locale 'it'|'en', phone}`; falls back to the site's `hours` block for windows |
| Slots | `lib/booking/slots.ts` — pure `computeSlots`: a seating must **start** inside a window, the **smallest free table** that seats the party wins, lead time and closed dates honoured, zone-correct (`date-fns-tz`) |
| Words | `lib/booking/i18n.ts` — one table, `it` + `en`, a test pins key parity |
| Reads/writes | `lib/booking/db.ts` |
| Emails | `lib/booking/notify.ts` — guest (if they left an email) + restaurant (`meta.contact.email`); courtesy after the row exists, never before |
| Block | `components/admin/templates/render-blocks/table-booking.tsx` (registered in `blockSchema.ts`, `types/blocks.ts`, `defaultBlockContent.ts`, `renderBlockRegistry.ts`) |
| Routes | `app/api/booking/[templateId]/{availability,book,day,phone,cancel}` |
| Owner page | `app/merchant/bookings/[templateId]/page.tsx` + `components/merchant/bookings-client.tsx`; index `app/merchant/bookings/page.tsx` |
| Seed | `scripts/seed-italy-demo.mts` (dry-run default; `--apply`; `--apply --bookings` reseeds the sample bookings from today) |
| Tests | `lib/booking/__tests__/booking.test.ts`, `unconfiguredBlocksStaySilent.test.tsx` |

## The routes

| Route | Who | What |
|---|---|---|
| `GET …/availability?date=&party=` | public, 120/h/IP | free times for the party, each with the table it would get |
| `POST …/book` | public, 12/h/IP | **re-derives the slot from today's availability** (a tampered start, a table too small, a time outside the windows → `invalid`); the exclusion constraint answers a race with `taken` (409) |
| `GET …/day?date=` | owner/admin session, **or** HiveJournal (`X-Partner-Id: hivejournal`, HMAC-SHA256 hex over `pathname + search` in `X-Partner-Signature`, shared `PARTNER_QUICKSITES_SECRET`) | the day's tables + bookings, plus `tz`, `closed`, `windows: [{open,close}]` for that date (`[]` when closed), `slot_minutes`, `seating_minutes`, `max_party`. **The partner shape carries no guest phone, email or notes** — a floor plan needs seats, not contact details |
| `POST …/phone` | owner/admin, **or** HiveJournal (HMAC over the **raw body**) | `{date, time:'20:00', party, table_id?, name, phone?, notes?}` or the contract's `{table_id, party_size, starts_at, guest_name, guest_phone?}` — no lead time; a named table that is not free → `taken`; a partner gets the row back without phone/email |
| `POST …/cancel` | owner/admin, **or** HiveJournal | `{booking_id}` cancels (the table reopens that second); `{booking_id, status:'seated'|'no_show'|'booked'}` marks |
| `GET/POST …/tables` | owner/admin, **or** HiveJournal | GET lists active tables. POST `{tables:[{ref, label, seats}]}` creates them (≤40; `seats` REQUIRED 1–40 — a table the photo could not count is filled by the owner, never defaulted) and answers `{ref, id, label, seats, existing}` in the caller's order; **an existing label is the same table** (its id back, `existing:true`, seats untouched). The step that turns HJ's plan-from-image proposal into rows after the owner confirms. `lib/booking/tablesInput.ts` |

| `GET/POST …/link` | owner/admin session | GET the link state; POST mints a one-time code (15 min, single use) + the HJ connect URL. A guest-build session gets `needs_signup` |
| `POST …/link/verify` | HiveJournal only (raw-body HMAC) | `{code, partner_ref}` → consumes the code, links the template; 404/410/409 otherwise |
| `POST …/unlink` | owner session **or** HiveJournal | ends the link (kept as history, never deleted) |

**Linking (2026-10-15):** a partner signature alone no longer reads any template. `day`/`phone`/`cancel`/`tables` answer `403 not_linked` unless the owner linked the site (`lib/booking/partnerLink.ts`); the demo is exempt by its flags (`is_demo` + `demo_kind`), never by id. Owner UI: the "Floor plan & food cost (HiveJournal)" card on `/merchant/bookings/<id>`. Contract section "Linking" in `restaurant-floor-plan.md`.

**Simulation sites (2026-10-15):** `data.meta.is_simulation = true` (`lib/booking/simulation.ts`) marks a restaurant AI personas run for a day on HJ's side. Separate from `is_demo` (a sim must be owner-linked like a real site). Changes exactly three things: no booking emails; a partner-signed `/book` on a sim+linked site skips the per-IP guest limit (`source` stays `web`, slot still re-derived, 409 still answers a race); excluded from the delivered.menu directory and published with `meta.noindex`. Sim site `trattoria-simulazione` (operator-owned, daily lunch + dinner, 8 tables). Contract section "Simulation sites".

| `GET …/menu` · `POST …/menu/icons` | owner/admin, **or** HiveJournal (linked) | the menu grouped by its own sections with each dish's delivered.menu icon key + the icon dictionary (`lib/menu/menuIconFeed.ts`); icon lookup for arbitrary names (ingredients). `null` = draw nothing. For HJ's food-cost planner (owner, 2026-10-15) |

Partner auth lives in `lib/booking/partnerAuth.ts`: a request without `X-Partner-Id` goes to the session gate; a partner header with a bad signature is refused and **never** downgraded to the session check. Verify before parse on the POSTs.

## Rules worth keeping

- **The block renders nothing in public until the site has bookable windows** (editor sees a hint). A booking form under a restaurant's name with no bookable table is an invitation to nothing.
- **The server never trusts the client's slot.** Availability is recomputed on every booking; the database settles the race.
- **Guest contact details never leave the owner session.** The partner `day` payload is name + party + table + time only.
- **Sample bookings are invented names on an invented restaurant**, phones `+39 333 000 000x`; the reseed deletes exactly that prefix.
- Demo-grade: EUR billing, SMS confirmations, the reseller setup for Italy are **not** here — they are later steps of the proposal.

## Not built (later steps / HJ's half)

Visual floor plan and food-cost calculator (HiveJournal, reading `day`), Premium analytics / supplier expense / revenue / shift management (Step 2), Stripe one-time + subscription in EUR.
