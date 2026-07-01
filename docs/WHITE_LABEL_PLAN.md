# QuickSites — White-Label Plan (Competitive Tier 1.5)

> How we close the **full white-label surface** gap vs Duda/GoHighLevel — the reseller motion where an agency's clients see the agency's brand, not ours.
> Companion to [`COMPETITIVE_LANDSCAPE.md`](COMPETITIVE_LANDSCAPE.md) (§8 Tier 1.5), [`MONETIZATION.md`](MONETIZATION.md) (Model B), and [`../CLAUDE.md`](../CLAUDE.md).
> Created: 2026-07-01 · grounded in a full surface audit (file:line touch-points below).

---

## Why this matters (the wedge)

Duda's white-label is **self-serve and brand-front-and-center**: the editor, client login, dashboards, and auto-emails all rebrand. GHL's SaaS Mode does the same for $497/mo. Our differentiated model (take-rate + lifetime residual) only *sells* once a partner can put **their** brand in front of **their** clients without an admin in the loop. Today branding is partial and admin-operated — this plan makes it a first-class, self-serve surface.

**White-label eligibility already has a signal:** `organizations_public.billing_mode` ∈ `central | reseller | none` (see `Org` in [`../lib/org/resolveOrg.ts`](../lib/org/resolveOrg.ts)). Gate every branded surface on `billing_mode === 'reseller'` so central/default orgs keep QuickSites branding.

## What already exists (reuse — do NOT rebuild)

The org/brand plumbing is **mostly done**; the gaps are a missing endpoint + hardcoded strings, not missing architecture.

- **Brand data model** — `organizations_public` (`name`, `logo_url`, `dark_logo_url`, `favicon_url`, `theme_json`, `support_email`, `support_url`, `billing_mode`). Resolved host→org (with `?org=` / `qs_org_slug` cookie override) by `resolveOrg()` in [`../lib/org/resolveOrg.ts`](../lib/org/resolveOrg.ts).
- **Server → client plumbing** — `middleware.ts` sets `qs_org_slug` + `x-qsites-org`; `app/layout.tsx` calls `resolveOrg()` and passes `org` into `app/providers.tsx` → `OrgProvider` / `useOrg()` (client hook). Favicon + `<title>` are **already** org-branded in `app/layout.tsx`.
- **Client branding hook** — [`../hooks/useOrgBranding.ts`](../hooks/useOrgBranding.ts) (env → `/api/org/branding` → subdomain lookup).
- **Partner invite** — `/join/[code]` already injects the partner name; `/partners/dashboard` shows the branded invite URL.

## The one shared foundation (ship first)

Everything below consumes **one** brand resolver. There are two halves, one server-only, one for the browser:

1. **`GET /api/org/branding`** — *referenced by 4 callers but does not exist yet* (`app/login/LoginForm.tsx:62`, `app/login/login-client.tsx:86`, `app/admin/register.tsx:88`, `hooks/useOrgBranding.ts:79`). Implement it as a thin org-aware route: `resolveOrg()` → `{ name, logo_url, dark_logo_url, favicon_url, theme_json, support_email, billing_mode }`. **This single ~30-line route lights up the already-wired login + register pages** (Slice 2 is 80% done behind it).
2. **`orgEmailBrand()`** — a server helper (in `lib/email.ts` or `lib/org/`) that maps `resolveOrg()` → `{ fromName, fromEmail, logoUrl, footer, supportEmail }`, with env/default fallbacks. Every email sender calls this instead of hardcoding.

Foundation effort: **S**. It unblocks Slices 1 + 2 at once.

---

## Slices (ordered, each independently shippable)

### Slice 0 — Foundation *(S)* · ✅ **shipped (branding endpoint)**
- ✅ `GET /api/org/branding` (`app/api/org/branding/route.ts`) — `resolveOrg()` → pure `buildOrgBranding()` (`lib/org/branding.ts`), gated on `billing_mode === 'reseller'`, 404 otherwise so central orgs fall through unchanged. Emits both `logo_dark_url` + `dark_logo_url` (callers disagree on the key). Unit-tested (`lib/org/__tests__/branding.test.ts`).
- ⏳ `orgEmailBrand()` server helper — deferred to **Slice 1** (where the email senders that consume it live), to avoid shipping an unused export.
- Note: `useOrgBranding` skips the API on localhost unless `NEXT_PUBLIC_ORG_BRANDING_TRY_API=1`.
- **Done:** the already-wired login/register pages now light up from the live endpoint for reseller hosts; central hosts get 404 → QuickSites default (no regression).

### Slice 1 — Branded transactional emails *(M)* · ✅ **shipped**
The central helper [`../lib/email.ts`](../lib/email.ts) defaulted to `'delivered.menu <noreply@your-domain.com>'` (stale) and every sender hardcoded "QuickSites" / `*.quicksites.ai`. Now routed through `orgEmailBrand()`.

- ✅ `lib/email.ts`: added pure `buildEmailBrand()` + `extractEmailAddress()` and async `orgEmailBrand()` (resolveOrg → reseller ? org brand : QuickSites); fixed the stale `delivered.menu` defaults. Unit-tested (`lib/__tests__/emailBrand.test.ts`, 8 cases).
- ✅ Wired the customer-facing senders: welcome (`resend-welcome-email`), invite (`admin/invite`), badge (`notify-creator`), contact confirmation + owner notify (`send-contact-email`) — each now sends under `brand.from` with `brand.footer`/name.
- **Decision applied:** central verified sender address (from `EMAIL_FROM`), org name in the display-name + subject + footer. A true per-domain sender is a later additive `organizations_public.email_from` column.
- Deliberately left: `app/api/contact/route.ts` (internal sales notification *to us*, not customer-facing) and `cron/email-drain` (sends pre-composed queued HTML; its `from` default is now QuickSites, not `delivered.menu`).
- **Done:** a reseller org's welcome/invite/badge/contact emails show that org's name + footer; central orgs unchanged. tsc + jest green.

<details><summary>Original touch-point table (for reference)</summary>

The central helper [`../lib/email.ts`](../lib/email.ts) defaults to `'delivered.menu <noreply@your-domain.com>'` (stale) and every sender hardcodes "QuickSites" / `*.quicksites.ai`. Route all through `orgEmailBrand()`.

| File | Touch |
|---|---|
| `lib/email.ts:15–38` | `sendEmail()` takes an optional `brand`; default `from`/footer come from `orgEmailBrand()` not `delivered.menu` |
| `lib/email.ts:106–132` | templates accept `siteName`/footer from brand |
| `app/api/contact/route.ts:10,81` | subject/from via brand |
| `app/api/notify-creator/route.ts:40,42,47` | swap `awards@quicksites.ai` + subject + URL |
| `app/api/admin/invite/route.ts:76,78,104–110` | `INVITE_FROM` + subject + invite HTML |
| `app/api/resend-welcome-email/route.ts:17,19,29` | subject/from/"The QuickSites Team" footer |
| `app/api/send-contact-email/route.ts:35,47` | sender + confirmation copy |
| `app/api/cron/email-drain/route.ts` | pass through brand where an order/org is known |

- **Decision:** per-partner sender identity needs a verified sending domain in Resend. First cut = **central sender, org name in the display-name + subject + footer** (`"{org.name} <noreply@quicksites.ai>"`); add an optional `organizations_public.email_from` + `email_signature` column later for true per-domain senders.
- **Accept:** a reseller org's welcome/invite/contact emails show that org's name + logo + support address; central orgs unchanged. `htmlToText` still clean.

</details>

### Slice 2 — Branded client login / join / auth *(S–M)* · ✅ **shipped**
Unlocked by Slice 0.
- ✅ `app/login/LoginForm.tsx` + `login-client.tsx`: already consumed `/api/org/branding`; now that the route exists, reseller hosts render the org logo/name. (The hardcoded dev-email prefill at `LoginForm.tsx:127` is dev-only — left as-is.)
- ✅ `app/join/[code]/page.tsx`: headline + partner-default name now use the resolved brand (`org.name` when `billing_mode==='reseller'`, else "QuickSites"); the platform reseller-recruitment CTA is hidden on white-labeled sites so it can't leak "become a QuickSites reseller" under a partner's brand.
- ⏳ `app/api/login/route.ts`: the magic-link OTP email is sent by **Supabase Auth**, not us — branding its body is a Supabase-side template task (ops), out of scope here.
- ⏳ Optional: theme the join CTA from `theme_json` (deferred; colors are a cross-cutting v2 item).
- **Done:** on a reseller host, `/login` + `/join/[code]` show the partner brand; central host shows QuickSites (verified via the 404 fallback + build).

### Slice 3 — Branded editor / admin chrome *(M)* · ✅ **shipped**
- ✅ `components/admin/admin-chrome.tsx` (GuestChrome) and `components/admin/AppHeader/app-header.tsx` (skeleton + guest header): the hardcoded "QuickSites" wordmark now comes from `useBrand()` (the purpose-built hook in `app/providers.tsx`), gated on `billingMode === 'reseller'`. Org flows via `OrgProvider` from `app/layout.tsx`, so it's prop-free and hydration-stable (context-derived → identical SSR + CSR).
- ✅ Logo image: the admin guest chrome + `/join/[code]` now render the reseller's logo (`dark_logo_url || logo_url`) via a plain `<img>` (avoids the next/image host allowlist; the login page already did this). Falls back to the default favicon/text when no logo is set.
- ⏳ Optional: header accent from `theme_json` (deferred, cross-cutting v2).
- **Decision applied:** first cut = **header wordmark + login**, not deep editor internals (Duda-parity baseline is "brand front-and-center," not every pixel).
- **Done:** a reseller admin sees their name in the chrome; central admin unchanged; no layout change (text swap only).

---

## Status: Tier 1.5 slices 0–3 all shipped ✅
Foundation + login/join + emails + admin wordmark/logo are live. Remaining follow-ups are infra/ops-gated, not code:
- **Per-domain email sender** — needs a verified sending domain in Resend + an `organizations_public.email_from` column (schema decision). Today: central verified domain, org display-name/footer.
- **Supabase-Auth magic-link email body** — branded via a Supabase project email template (ops), not app code.
- **`theme_json` color accents** — optional cross-cutting polish (CTA/header accent from the org theme).

---

## Sequencing
**Slice 0 → Slice 2 → Slice 1 → Slice 3.** Rationale: Slice 0 is tiny and unblocks the most; Slice 2 is nearly free once 0 lands (highest visible payoff per effort); Slice 1 is the biggest single win for Duda parity ("auto-emails rebrand"); Slice 3 is the most invasive, do last.

## Cross-cutting decisions (recommended defaults)
1. **Eligibility gate:** brand only when `billing_mode === 'reseller'`; else QuickSites. *(prevents leaking a half-config brand onto the default site.)*
2. **Email sender:** central verified domain + org name in display-name/subject/footer first; per-domain sender is a later additive column.
3. **Admin white-label depth:** header + login, not the full editor internals (first cut).
4. **Colors:** `theme_json` drives accents where cheap (CTA, header); don't chase full theming in v1.

## Explicitly out of scope (for this plan)
- Per-partner custom sending domains / DKIM setup (ops + a schema column; later).
- Branding the Supabase-Auth magic-link email body (Supabase-side template, not app code).
- Custom CSS/HTML injection à la Duda (separate, larger effort).

---

**Audit provenance:** surface map (every email sender, login/join/auth page, admin chrome component) generated 2026-07-01; file:line references above are from that pass. Verify against the working tree before editing — this doc is a map, not a spec.
