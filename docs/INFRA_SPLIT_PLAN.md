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

### 1. A tenant root that is not `quicksites.ai` — **LIVE 2026-10-21 on `qspages.com`**

**Carried out 2026-10-21 (owner: "vercel card should be valid now").** Bought for $11.25 (order
`01M5FN4BSAREKK1EE1HPQPC470`, `draft → purchasing → completed` in 20 s), zone at Vercel, the three
project entries verified. ⚠️ **No certificate was issued for 25 minutes and nothing said so**: the
entries had been attached on 10-19, two days BEFORE the registration landed, and Vercel issues a
certificate when a domain is added — it does not retry a pre-registration attempt. `v8/certs?domain=`
listed none; HTTP answered 404 (the app) while HTTPS closed the handshake. Detaching and re-adding
the three entries issued all three certificates within 15 s. **Attach after the registration
completes, or re-add.** Then `NEXT_PUBLIC_TENANT_ROOT=qspages.com` (production + preview),
`vercel redeploy` of the production build (3.5 min). Measured after: `/status` `tenant_root: ready`;
`sandon.quicksites.ai/about?x=1` → 308 `sandon.qspages.com/about?x=1`; `qspages.com` and `www` → 308
the brand homepage; `sandon.qspages.com` 200, self-canonical; `nosuchsite.qspages.com` 404;
`graftontowing.com` unchanged; the operator pages (`/admin/templates`, the editor, `/admin/outreach`)
print no old-host text; the editor's preview pane builds its link from the registry.
⚠️ **The source guard had blessed nine spots that still printed the old host** — found by reading
the served homepage after the switch, not by any test: the showcase caption `{s.slug}.quicksites.ai`
(JSX TEXT, not a template literal), five admin pages doing the same, the publish-success panel
and the editor toolbar's "Site address once published", a literal `'https://renton-lemonade.quicksites.ai/'`
on `/lemonade-stands` and in the probe targets, and the favicon route's host map. None matched the
four shapes the guard knew (`${…}.quicksites.ai`, `endsWith`, a regex, a bare-root constant). All
read the registry now, and the guard gained the three missing shapes with samples that must trip
them (`www.`/`app.` are the app and stay allowed). A guard matches the shapes you thought of; the
move is what finds the rest. **Step 6 became a renderer rule** (see 6).

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

**The owner picked `qspages.com` (2026-10-18 evening).** ⚠️ **Two purchase attempts on
2026-10-19 both ended `payment-failed` at the Vercel registrar** (orders `draft` → `failed`
within ten seconds; three domains had bought fine on the same card three hours earlier). The
first attempt went through `purchaseDomain`, which reported "bought $11.25" on the buy
endpoint's 200 — a receipt for the ORDER, not the domain — and the next twenty minutes probed
a host that was never registered. `purchaseDomain` now waits on
`GET /v1/registrar/orders/{orderId}` and reports `order_failed:<code>` / `order_pending`
(`lib/domains/__tests__/purchaseOrder.test.ts`). The three project-domain entries
(`qspages.com`, `www`, `*.qspages.com`) are attached and will verify by themselves once the
registration lands. **Owner: check the team's payment method in Vercel → Settings → Billing,
then re-run `scripts/_scratch/tenant-root-buy.mts --apply` (it prints the order and polls it)
or buy `qspages.com` in the Vercel dashboard.** Then steps 3–6 below.

**To switch on (owner, in this order — the order is the whole point):**
1. Buy the root (≈$11; the Vercel registrar is already enabled on this team). Candidates free
   on 2026-10-18 by RDAP: `qsitehost.com`, `qsitepages.com`, `quicksitehost.com`,
   `qspages.com` (chosen), `sitesbyqs.com`, `qs-sites.com`, `qsite.site`. `qsites.com` is taken.
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
6. ~~Nominate canonicals for platform-only published sites~~ — **a renderer rule instead
   (2026-10-21).** Google had indexed 52 of the 109 `www.quicksites.ai/sites/<slug>` copies the
   inspection sweep knows, and `nominate-custom-domain-canonicals.mjs` covers custom-domain sites
   only; a per-site nomination for the 103 platform-only published sites would be ~100 data writes
   that each republish a draft (a customer's unreviewed edits riding along with a canonical).
   `lib/seo/canonicalUrl.ts#defaultCanonicalOrigin`: nomination wins; no root → self (unchanged);
   a custom domain of its own → self; otherwise `https://<slug>.<root>`. Applied in the `/sites`
   route, so every served copy changed without a republish; `publicIndexUrl` submits the tenant
   host to IndexNow by the same bar. Pinned by `lib/seo/__tests__/defaultCanonicalOrigin.test.ts`.
   ⚠️ **Follow-up (owner or a script with the operator GSC token): a Search Console property for
   `qspages.com`** — the indexing sweep inspects pages on their canonical origin, and it has no
   property for the new root yet, so the 103 sites drop out of `/admin/seo/indexing` until one
   exists (DNS TXT verification; the zone is at Vercel).

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
