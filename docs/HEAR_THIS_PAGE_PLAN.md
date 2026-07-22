# "Hear this page" — platform-wide narrated audio

> A compact **🔊 Hear this page** launcher on every PUBLIC surface, playing the page's
> **short version** (`summary`) in a house narrator by default, super-admin-configurable
> to add more registers per surface. A mesh-wide standard (QuickSites + HiveJournal +
> PorchHearth). Powered by HiveJournal's **About That** — see
> [`crosstalk/contracts/about-that-embed.md`](../.claude/worktrees/restaurant-llm-copy/../../../crosstalk/contracts/about-that-embed.md).

Distinct from the opt-in **In Your Voice** block (owner voice on a specific page,
`about_that` block). Hear-this-page is a site-wide **house-narrator** baseline; where an
owner has added their own In Your Voice block, that owner-voice player is the richer
experience.

## Status

- **Phase 1 — built, flag OFF.** Summary-only launcher, mounted once in the root layout,
  self-gating by flag + configured embed + public pathname. Passes `data-kinds="summary"`
  to the loader (`AboutThatEmbed` `kinds` prop) so the short version is enforced client-side.
- **Phase 2 — built.** Super-admin `site_settings` config (`hear_this_page`): per surface
  (`home` / `sites` / `marketing`) enable + choose registers, `summary` always the baseline.
  Feeds `resolveKinds(pathname, settings)` → `data-kinds` (narrows only). Admin UI at
  `/admin/hear-this-page`, API `app/api/admin/hear-this-page`, loader
  `lib/hearThisPage/settings.ts`. The env flag stays the master switch + billing gate on top.

## Files (QuickSites)

- `lib/hearThisPage/config.ts` — flag, embed id, `DEFAULT_KINDS=['summary']`, pathname
  denylist (`hearThisPageVisibleFor`), `resolveKinds()` seam for Phase 2, honest voice label.
- `components/hear-this-page.tsx` — the launcher (collapsed pill → expands the About That
  player grounded at `origin+pathname`, house narrator, dismissible, collapses on nav).
- `app/layout.tsx` — mounts `<HearThisPage />` once beside `CartFab`.

## Enable in an environment

The house embed is baked in as the default (`1cda57cc-23f0-4973-b49e-6620b60137ce` —
"QuickSites — Hear this page (platform house)", house narrator, allowed
`quicksites.ai`+`delivered.menu`, kinds `summary`+`pitch_panel`+`eli10`), so the **single
switch** to arm it is:

- `NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED=1`

**Flipping this flag ON = real QS-billed TTS renders** (one per unique page-content+kind on
first listen; daily per-embed cap is the spend guard). Held OFF until the owner explicitly
greenlights the spend + rollout scope. `NEXT_PUBLIC_HEAR_THIS_PAGE_EMBED_ID` still overrides
the embed if needed.

## HiveJournal answers (resolved 2026-07-22)

1. **Per-instance kind restriction** — ✅ **BUILT (HJ #1475).** Loader `data-kinds` comma
   allowlist off one embed; narrows-never-widens (backend gates by `enabled_kinds`). Wired
   via `AboutThatEmbed`'s `kinds` prop.
2. **Domain-allow** — `isDomainAllowed` matches on a dot boundary, so one entry `quicksites.ai`
   covers apex + every subdomain (and `delivered.menu`). Tenant custom domains = add each apex
   to the embed's `allowed_domains` (automatable on domain-attach; HJ can expose a
   `POST /api/about-that/embeds/:id/domains` add-one endpoint).
3. **Billing / cache** — cache key = `(embed_id, content_hash)` where
   `content_hash = sha256(kind, voice, tone, preset, lang, page_text)`: free repeats,
   auto-fresh on content change, shared render across identical-content URLs. QS platform
   house embed = **QS-billed** (one render per unique content+kind on first listen; a daily
   per-embed render cap is the spend guard). **Enabling renders = a conscious money step**,
   surfaced to the owner before flipping on broadly.

**House-narrator embed:** HJ mints on request (`voice_mode:'house'`,
`allowed_domains:['quicksites.ai','delivered.menu']`, kinds incl. `summary`). Set its uuid as
`NEXT_PUBLIC_HEAR_THIS_PAGE_EMBED_ID` to arm Phase 1.

## Mesh adoption

- **PorchHearth** — adopting **rentals-first** (property/rental pages v1: house narrator
  default, host's own voice once cloned via `host-voice.md`), expanding to
  neighborhood/meal/tiny-home surfaces after v1 proves. Reuses PH's host-voice
  partner-provisioning rail. Confirmed by owner directly.
- **HiveJournal** — asked to add hear-this-page to HJ's own public surfaces (summary
  default, super-admin-configurable).

## Honesty

House narrator is always labeled as such (`Narrated · the short version`); an owner/host's
own voice is used only via a consented clone. The `whats_new` commerce guardrail
(guest-negative diffs omitted, default ON) carries automatically if a super-admin ever
enables that register on a commerce surface — HJ owns that gate.
