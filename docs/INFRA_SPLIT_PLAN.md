# Infra split-off — isolation tiers for one platform that hosts strangers and our own ventures

> Owner question, 2026-10-18: *"what risk do we take of getting all websites blocked if one of
> them gets reported for something? is it safer to not open the platform up to other developers
> and just use it for my own ventures?"* Owner direction the same evening: **start the split-off.**

## The answer, in one paragraph

The blast radius is **shared infrastructure, not customers**. Closing the platform removes none
of it, because the riskiest tenants are our own ventures: ~100 geo pitch sites asserting company
names that do not exist (Google's doorway / fake-business pattern), a supplement store that
cannot be on our Stripe, and outreach texts that can draw spam complaints onto the one Twilio
service every tracking line shares. Other developers add exposure mainly in Stripe, Twilio and
email — the three cheapest things to isolate. So: **tiers, not a gate.**

## Shared failure points, biggest first

| # | One of these… | …takes down | Isolation |
|---|---|---|---|
| 1 | **Google Safe Browsing on `quicksites.ai`** — every tenant site also serves at `<slug>.quicksites.ai`; a flag lands on the *registrable domain* | every subdomain, the admin, the marketing site | a tenant root that is not the brand (**step 1, code merged**) |
| 2 | **One Vercel project / account** (~300 domains) and **one Supabase project** | everything | a second Vercel project for own ventures vs clients; Supabase stays (RLS + service role split is route-level) |
| 3 | **One Stripe platform account with Connect** — Stripe suspends the PLATFORM for a prohibited merchant | every merchant's payouts | prohibited-category list at onboarding; high-risk merchants never on our Stripe (B Hard precedent) |
| 4 | **One Twilio messaging service** — spam complaints (incl. our own pitch texts) suspend it | every line's texts (voice is separate) | a second messaging service for outreach vs operational notices |
| 5 | **One email sending domain** | everyone's deliverability | per-tenant Resend domains for tenant mail |
| 6 | **Google Search** — per-domain, EXCEPT a detectable network of templated sites | the geo cohort | rename-on-payment (the pitch site names its real renter); geo sites off the brand root |

## Tiers

- **A — own ventures** (geo sites, B Hard, delivered.menu, lemonyum, yardsalesites): their own
  Vercel project + their own roots. Already off the brand root except the platform-subdomain copy.
- **B — clients and resellers**: the tenant root (never `quicksites.ai`), Connect onboarding with
  a prohibited-category list, a separate Twilio messaging service, per-tenant sending domains.
- **C — anonymous guests**: already cannot publish (`needs_signup`).

Plus, for all tiers: an abuse address, a takedown-within-hours runbook, and one-click unpublish
(the `archived` flag exists and the admin list already filters it).

## Steps and status

### 1. A tenant root that is not `quicksites.ai` — **code merged 2026-10-18, inert until set**

- **Registry:** `lib/sites/tenantRoot.ts` — ONE import-free module (safe in `'use client'` files
  and the Edge middleware), read at call time. `tenantRoot()` = `NEXT_PUBLIC_TENANT_ROOT` else
  the brand root; `tenantSiteHost(slug)` / `tenantSiteUrl(slug)` build links;
  `tenantSiteHosts(slug)` returns every platform host a slug has ever had (for lookups and GSC
  key matching — never for a link); `siteSlugFromHost(host)` parses; `legacyTenantRedirectHost`
  and `isTenantRootApex` drive the middleware.
- **Source guard:** `lib/sites/__tests__/tenantRoot.test.ts` fails the suite if any code outside
  the registry builds or recognises a tenant host from the brand root (template literal,
  `endsWith`, regex, or a default/constant). It matches code shapes after stripping comments — a
  comment naming the old host is not a violation. 36 files and 4 scripts were migrated through it.
- **Middleware:** `PLATFORM_DOMAINS` comes from the registry; once a root is configured,
  `<slug>.quicksites.ai` → **308** `<slug>.<root>` (path + query kept), and the root's apex/www →
  308 the brand homepage. Custom domains, reseller roots and the app host are untouched.
- **Lookups that still name the old host:** `sites.default_subdomain` (legacy table) and
  `published_sites.domain` were written as `<slug>.quicksites.ai`; readers now match on
  `tenantSiteHosts(slug)` (both hosts). Nothing is backfilled — a row is a record of what was
  written, and the alias read makes the backfill unnecessary.
- **Gate:** `tenant_root` on `/status` (`lib/config/health.ts`), `.env.example` entry.

**To switch on (owner, in this order — the order is the whole point):**
1. Buy the root (≈$11; the Vercel registrar is already enabled on this team). Candidates free
   on 2026-10-18 by RDAP: `qsitehost.com`, `qsitepages.com`, `quicksitehost.com`,
   `qspages.com`, `sitesbyqs.com`, `qs-sites.com`, `qsite.site`. `qsites.com` is taken.
   ⚠️ Not a `.ai` and not a name that reads as the brand: the point is that a flag on it is a
   flag on hosting, not on QuickSites.
2. Attach `<root>`, `www.<root>` and `*.<root>` to the Vercel project (the same three entries
   `quicksites.ai` has; the wildcard needs the zone at Vercel, which a registrar purchase gives).
3. Confirm with a curl that `https://anything.<root>/` answers (it will 404 as "no such site" —
   that is the app answering, which is the test).
4. Set `NEXT_PUBLIC_TENANT_ROOT=<root>` in production **and preview**, redeploy (a rebuild).
5. Look at: a tenant subdomain on the OLD host (expect 308), the same slug on the new host
   (expect the site, self-canonical to the new host), a custom-domain site (unchanged), the
   editor's "View live site" link, the admin templates list, the homepage showcase, one claim
   postcard preview (`/admin/outreach`), and `/status` (`tenant_root: ready`).
6. Nominate canonicals for platform-only published sites if Google already indexed the old host
   (`scripts/nominate-custom-domain-canonicals.mjs` reads the root from env).

### 2. A second Vercel project (own ventures vs clients) — not started
The geo sites and B Hard go with the ventures. A project split is a DNS move per domain
(~100 custom domains) and a second set of env vars; do it when a partner is about to onboard
merchants, not before.

### 3. Stripe / Twilio / email — not started
- Stripe: review Connect onboarding (`app/api/connect/onboard`) against Stripe's prohibited
  and restricted businesses list BEFORE any partner onboards merchants; add the category
  question to onboarding and refuse, never "review later".
- Twilio: a second messaging service for outreach (pitch texts, claim postcard SMS) vs
  operational notices (missed-call texts, taken-call texts, replies) so a complaint on a cold
  text cannot silence the lines that serve paying businesses.
- Resend: per-tenant verified sending domains for tenant campaigns; the merchant auto-reply
  already sends from our verified address with the merchant's name only.

### 4. Abuse handling — not started
An `abuse@` address on the marketing site, a runbook (who looks, within what time, what
"unpublish" means for each tier), and a one-click unpublish that sets `archived` and clears
`published_sites` for a template id.

## Verified / assumed (§9)

**Verified:** `*.quicksites.ai` is a verified wildcard on the Vercel project (API, 2026-10-18);
no `NEXT_PUBLIC_BASE_DOMAIN` is set in production (`vercel env ls`); the registrar path works
(vashon-plumbing.com was bought through it 2026-10-17); the guard's hit list before migration
was 36 files; the guard passes after; `tsc` and the touched suites pass.
**Assumed:** that Next inlines `process.env.NEXT_PUBLIC_TENANT_ROOT` into the Edge middleware
bundle the same way it does for `NEXT_PUBLIC_MENU_BASE_DOMAIN` (which the menu branch of the
same middleware already relies on) — true by the same mechanism, not separately tested until
the root is set.
