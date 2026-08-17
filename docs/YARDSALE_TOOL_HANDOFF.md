# yardsalesites.com — the useful tool: what exists, what's next

**Written 2026-08-17.** Every claim below was checked against the live site or the DB at that
time, and each says which. Re-run anything you're about to rely on — this document has a shelf
life and the section headings say so where it matters.

---

## 1. The strategy, in one paragraph, because it decides everything else

Reviewed by PorchHearth and HiveJournal (crosstalk 2026-08-17) and settled: **ship a tool, not a
marketplace.** The only sentence about this product that is true today needs no directory —

> *a page for your sale, with your photos and your address, that you can text to anyone*

— and it is worth exactly the same to the first seller as the thousandth. The directory accretes
as a by-product; *"more buyers will find your sale"* becomes sayable when it becomes true. This
dissolved the supply-first/demand-first fork that the postcard plan was stuck on
(`docs/YARDSALE_POSTCARDS_SEPT.md` §3a).

**Consequence for anyone building here:** never add copy promising shoppers. A seller who reads
"more shoppers" and gets none has been mis-sold, and in a hyperlocal market that seller is also the
only distribution there is — they tell their neighbours.

## 2. What exists and works (verified)

| Thing | Where | State |
|---|---|---|
| Self-serve create | `/yard-sale/new` → `POST /api/garage-sales/create` | **live**, no sticker, no account, no fee |
| Sale page | `/s/<code>` | live; QR + printables key off the code |
| Directory | `/garage-sales`, apex of yardsalesites.com | live, **honestly empty** |
| Sticker claim | `POST /api/garage-sales/activate` | live (the original, pre-existing path) |
| Setup form | `ActivateForm` in `app/s/[code]/sticker-client.tsx` | **one form, two doors** — a `code` prop claims a sticker, no code creates from nothing |

`garage_sales` is a **genuine queried zero** — no rows. That makes it a real baseline: any count
later is measured against nothing, not against noise.

## 3. ⚠️ Two bugs fixed today that you must not reintroduce

### The truncation bug — `normalizeCode` manufactured validity

`normalizeCode` ends with `.slice(0, CODE_LEN)`, which is forgiving for typed input and
catastrophic on a URL segment. It turned any long word into a legal code once its first six
alphabet-legal characters happened to be legal:

```
'yard-sale'    → 'YARDSA'  accepted  → swallowed /yard-sale/new, the front door
'garage-sales' → 'GARAGE'  accepted  → swallows the directory at its own path
'privacy'      → 'PRIVAC'  rejected  — only because 'I' is absent from the alphabet
```

So the pages that worked were surviving by **luck**. Live evidence:
`yardsalesites.com/yard-sale/new` returned **200** and served *"We don't recognise that code."*

Two things made it hard to see, both worth internalising:

1. **The code branch in middleware runs BEFORE the apex-page allowlist.** Adding `'yard-sale'` to
   `APEX_PAGES` — which is what I tried first — cannot rescue a path the code branch already took.
   A fence entry is necessary and not sufficient.
2. **The wrong answer was a 200, not a 404.** Every availability check said the route was fine.

Fixed by `isCodeShapedSegment` (strict, no truncation) used by both the path and **subdomain**
resolvers — the subdomain had the same flaw, so `shop.yardsalesites.com` would have been served as
a stranger's sale page. Pinned by `lib/garageSales/__tests__/codeShapedSegment.test.ts`.

### The OG image lied about its format

`/api/og/[slug]/image` stamped `Content-Type: image/svg+xml` from its cache **filename** while
serving PNG bytes, so the LemonYum example rendered as a broken-image icon. Fixed by sniffing the
bytes (`lib/og/imageContentType.ts`). Same file also queried `published_sites.slug`, **a column
that does not exist**, so branding silently never loaded for any OG image. (#833)

## 4. Next, in the order I would do it

### (a) The apex still sends sellers to a dead end — ⚠️ NOT MY FILE

The empty state on `/garage-sales` reads:

> *"If you're running one and someone handed you a sticker, scan it to get listed."*

That was true before today and is now the **only** path it mentions, while self-serve exists and is
free. It is the exact dead end the front door was built to remove, still being advertised on the
domain we want to rank.

**`/garage-sales` belongs to the agency-branding session** under the ownership split agreed
2026-08-17 (they hold the directory + strategy docs + `lib/commerce/*`; this session holds the
create path + printables). So this is a one-line change **to hand to them**, not to take. It is the
highest-value item on this list.

### (b) Printable signs for a sale

`lib/lemonade/standSign.ts` is the working pattern: one self-contained HTML doc, SVG QR codes
inlined as data URLs, served by a route and printed by the browser. It gained a menu board and a
kerbside sheet today, and **rendering went ~20s → ~0s when the QRs became SVG** (a 2000px PNG QR
spends twenty seconds rasterising flat squares; a vector is crisp at any size).

For a yard sale the equivalent sheets are a kerbside sign with an arrow, the date/time, and the
short URL. Reuse the module rather than copying it.

### (c) Ranking — deliberately only half-answered

`/yard-sale/new` targets **seller** intent ("free yard sale listing", "make a yard sale page"),
which we can serve honestly today. The volume the owner found — **10k–100k/mo, low competition,
"yard sales near me"** — is **buyer** intent, and ranking for it now puts a searcher in front of an
empty week. City pages are worth building *after* there are sales to show. This is a live
disagreement worth re-litigating with evidence, not a settled point.

### (d) The postcard question is not a postcard question

`docs/YARDSALE_POSTCARDS_SEPT.md` — there is **no list** of yard-sale hosts (they self-identify at
the kerb three days before), which rules out the addressed-mail pipeline we already have and points
at USPS EDDM, which is a retail process rather than an API. Read §4 before spending postage.

## 5. Guardrails that are not negotiable

- **Addresses are block-level until the sale starts.** Enforced in `lib/garageSales/address.ts`, so
  every surface inherits it. `publicAddress()` is the only projection point.
- **A listing with no location cannot go in the directory**, but an *unlisted* sale with no address
  is allowed — the shareable link is the honest use case and refusing it would serve the
  speculative one.
- **A "sale" longer than two weeks is rejected.** A sale page expires from its own data; a
  three-month window is a standing advert wearing a weekend's clothes.
- **Never promise shoppers.** §1.

## 6. Working arrangement

Three QuickSites sessions share this repo. This work is in a **worktree** at
`../qs-yardsale` on `feat/yardsale-selfserve`, because the shared tree already produced two
mistakes in one afternoon — a commit straight to `main` with no PR, and a squash that swallowed
four unrelated commits under another PR's message. `git branch --show-current` before creating or
switching a branch is the interim discipline and is **known-insufficient**: every correction in
that exchange came from re-running a check, not from anyone being more careful.
