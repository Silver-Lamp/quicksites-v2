# Email Hosting Plan — "drop the $50/mo Google subscription"

> Scoped 2026-07-16. The wedge, verbatim from a real prospect (Amy / gracepointcollective.com):
> *"I am paying $50 a month for our domain through Google for website, workspace email.
> I really just want the domain address and email."*
> We now take the website (`/bring-your-domain`, PR #454). **Email is the last anchor
> holding small businesses to that $50/mo** — this plan makes us the email option too.

## 1. What "email hosting" actually means (three tiers)

| Tier | What the customer gets | How | Our COGS |
|---|---|---|---|
| **A. Forwarding + send-as** | `info@theirdomain.com` that lands in the Gmail they already use, and they can *reply as* that address | MX → forwarding provider; replies via authenticated SMTP send-as configured in Gmail | ≈ $0 (see §3) |
| **B. Real mailboxes** | Actual IMAP/webmail accounts (`amy@theirdomain.com` with its own inbox), per user | Resell a white-label mailbox provider via API | ~$1–3/mailbox/mo |
| **C. Self-hosted provider** | Same as B, on our own mail infrastructure | Stalwart / mailcow on a VPS | Ops burden: IP reputation, spam, backups, abuse desk |

**Recommendation: ship A first, sell B, never build C** (revisit C only at 1000+ mailboxes).
Tier A alone kills the $50/mo pain for the "I just want email at my domain" majority —
most sole proprietors don't need a second inbox, they need their domain's address to
reach the inbox they already live in.

## 2. Why this is nearly free for us to offer

The honest math on Amy's $50/mo: domain ≈ $1/mo, the rest is Workspace seats she barely
uses. Our bundle: site (already ours) + Tier A email (≈$0 COGS) + domain stays wherever
it is. Even Tier B at $5–6/user/mo undercuts Workspace Business ($7.20+/user) with
2–4× margin on a ~$1.50–3 wholesale mailbox.

## 3. Provider landscape (researched 2026-07-16)

- **[Forward Email](https://forwardemail.net/en)** — the Tier A front-runner. Open
  source, works with ANY DNS (plain MX + TXT records — no nameserver takeover, unlike
  Cloudflare Email Routing), **unlimited domains on one account**,
  [REST API](https://forwardemail.net/en/email-api) for domain/alias provisioning,
  ~$3/mo (Enhanced) for API + SMTP sending, IMAP storage available as an add-on. One
  $3–9/mo account could serve Tier A across our whole portfolio.
- **White-label mailbox resellers (Tier B)** — per-mailbox wholesale with provisioning
  APIs: [AtrioMail](https://atriomail.com/) (REST API for mailbox/domain provisioning),
  [PolarisMail](https://www.polarismail.com/white-label-email-hosting-for-resellers/),
  [Synergy Wholesale](https://synergywholesale.com/reseller-email-hosting/),
  [Mailbux](https://mailbux.com/whitelabel). Entry pricing typically €1–3/mailbox/mo
  with volume discounts. Needs a proper evaluation pass (deliverability reputation,
  webmail quality, EU/US data residency) before committing.
- **NOT the answer**: Resend (transactional-only — it stays for our system email);
  Cloudflare Email Routing (free but requires moving nameservers to Cloudflare — breaks
  our Vercel/Namecheap DNS automation).

## 4. Infrastructure we already have → what it maps to

| Existing | Role in email hosting |
|---|---|
| `lib/domains/byoDomain.ts` + `/bring-your-domain` (PR #454) | The instruction-card pattern extends to MX/SPF/DKIM/DMARC records; the flow's step 3 is the natural "want `info@yourdomain` too?" upsell |
| Vercel DNS (domains we registered) + `lib/domains/namecheap.ts` `setDnsRecords` | **One-click email setup** on domains whose DNS we control (geo land-grab portfolio, Vercel-bought apexes) — write MX/TXT programmatically |
| `lib/billing/*` + Stripe subscriptions | "Email" add-on SKU: Tier A flat per domain (or free with a paid site), Tier B per-mailbox quantity line item |
| `requireUser`/`requireTemplateOwner`, org tenancy | Alias management gated to the domain's site owner |
| Cron + `cron_runs` patterns, domain-verify precedent | Nightly MX/SPF verification sweep ("your email records drifted" alert) |
| Resend + `orgEmailBrand` | Stays the transactional layer; SPF records must include BOTH (`include:` both senders — watch the 10-DNS-lookup SPF limit) |
| Admin dashboards (`/admin/domains/costs` etc.) | An `/admin/email` panel: domains with email enabled, alias counts, verification state, provider costs |

## 5. Phased build

### Phase 0 — prove it by hand on gracepointcollective.com (zero code, ~1 hour) ← ACTIVE
The full click-by-click runbook, grounded in the domain's live DNS (verified
2026-07-16: Workspace MX `1 smtp.google.com`, Google Cloud DNS nameservers,
Squarespace parking on the apex, google-only SPF, no DMARC), lives in
[`EMAIL_HOSTING_PHASE0_RUNBOOK.md`](EMAIL_HOSTING_PHASE0_RUNBOOK.md) — including the
pre-flight with Amy (personal-Gmail destination, alias inventory, Takeout archive),
exact record changes + rollback values, the test matrix, and the go/no-go questions
the run must answer. **Phase 1 below stays a POTENTIAL until Phase 0's verdict.**
(The two migrations — site DNS and email MX — are independent.)

### Phase 1 — productize Tier A (flag: `EMAIL_HOSTING_ENABLED`, default OFF)
- `lib/emailHosting/provider.ts` — provider-agnostic adapter (`ensureDomain`,
  `createAlias`, `listAliases`, `deleteAlias`, `verifyDns`), Forward Email as the first
  implementation (their API key in env, one platform account, unlimited domains).
- Migration: `email_domains` (template/org-scoped, domain, provider, status,
  verified_at) + `email_aliases` (address, forward_to, created_by). Deny-default RLS,
  owner read; service-role writes (house rules).
- **DNS writes**: managed domains (Vercel DNS / Namecheap) get MX + TXT written
  programmatically; BYO domains get an MX instruction card (same component family as
  the `/bring-your-domain` DNS table). **Safety invariant: never write MX onto a domain
  that already has MX records** (that's someone's live email — Workspace users keep
  working untouched) — require an explicit "replace my email provider" confirmation.
- Owner UI: an "Email" panel (editor settings or `/admin/org`) — add/remove aliases,
  forward-to targets, verification status, Gmail send-as walkthrough.
- Ops: verification cron + `/admin/email` dashboard.
- Pricing decision (open): free-with-paid-site as a conversion weapon vs. $2–3/mo/domain.

### Phase 2 — Tier B mailboxes (paid)
- Pick the reseller (AtrioMail-class API evaluation), wire the adapter's mailbox ops,
  per-mailbox Stripe SKU ($5–6/user/mo), webmail link in the owner panel.
- Workspace exit runbook for customers: Google Takeout/IMAP migration steps, MX cutover
  checklist, "your old mail keeps working during the switch" guidance.
- Marketing: a `/keep-your-domain-drop-the-bill` page + calculator (their $50/mo vs.
  our bundle), and the `/bring-your-domain` step-3 upsell goes live.

### Phase 3 — explicitly deferred
Self-hosting (Stalwart) only if mailbox volume makes wholesale pricing material, and
only with a dedicated deliverability story. Email is the most support-intensive product
there is — margin means nothing if MX downtime burns trust in the sites product.

## 6. Risks / honest caveats

- **"Email keeps working" is now OUR promise.** The BYO flow currently promises we
  never touch MX; the email product deliberately DOES. Keep the two flows visually and
  verbally distinct, and gate every MX write behind explicit consent + existing-MX
  detection.
- **Deliverability is reputation-shared.** A spamming tenant on a shared provider
  account can hurt every domain. Tier A mitigations: aliases only for verified site
  owners, per-account caps, provider-side outbound limits.
- **Support burden**: password resets, "where's my email", client setup (IMAP settings
  on an iPhone). Tier A dodges most of it (their inbox is still Gmail); Tier B inherits
  it — factor into pricing.
- **SPF collisions** when a domain sends via us (Resend, org branding) AND the mailbox
  provider — one merged SPF record, mind the 10-lookup limit.

## 7. Open questions (for Sandon)

1. Tier A pricing: free with every paid site (conversion lever) or a $2–3/mo add-on?
2. Green-light the Phase 0 manual proof on gracepointcollective.com (after Amy confirms
   she's ready to cut over Workspace email)?
3. Tier B at launch or only once Tier A shows demand?
4. Does the reseller/white-label program (orgs) get email hosting to resell too? (It
   compounds the partner pitch: "sites + commerce + email under your brand.")
