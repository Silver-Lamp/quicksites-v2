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
  self-gating by flag + configured embed + public pathname.
- **Phase 2 — pending HJ.** Super-admin `site_settings` config to enable extra registers
  (`pitch_panel` / `eli10` / `whats_new`) per surface — gated on HJ supporting a
  per-instance kind allowlist (`data-kinds`).

## Files (QuickSites)

- `lib/hearThisPage/config.ts` — flag, embed id, `DEFAULT_KINDS=['summary']`, pathname
  denylist (`hearThisPageVisibleFor`), `resolveKinds()` seam for Phase 2, honest voice label.
- `components/hear-this-page.tsx` — the launcher (collapsed pill → expands the About That
  player grounded at `origin+pathname`, house narrator, dismissible, collapses on nav).
- `app/layout.tsx` — mounts `<HearThisPage />` once beside `CartFab`.

## Enable in an environment (all required)

1. `NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED=1`
2. `NEXT_PUBLIC_HEAR_THIS_PAGE_EMBED_ID=<platform house-narrator embed>` — **from HJ**,
   domain-allowed for `*.quicksites.ai`, `*.delivered.menu`, and tenant custom domains.

Until both are set, the launcher renders nothing.

## Blocked on HiveJournal (asked via crosstalk 2026-07-22)

1. **Per-instance kind restriction** — can the loader render only an allowlist passed per
   instance (e.g. `data-kinds="summary"`)? Gates the Phase 2 super-admin per-surface toggle.
2. **Domain-allow at scale** — wildcard for platform subdomains + a per-custom-domain allow
   (automatable on domain attach) + a platform house-narrator embed.
3. **Billing/cost at scale** — one TTS render per `(embed,url,kind)` on first listen, then
   cached; owner-billed per site vs a QS platform embed.

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
