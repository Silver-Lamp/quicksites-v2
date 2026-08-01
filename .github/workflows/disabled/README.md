# Disabled workflows

GitHub only reads `.github/workflows/*.yml` — it does not descend into subdirectories. So a
workflow parked here is off, and moving it back up one level turns it on again. Nothing has been
deleted.

## Why these were parked (2026-07-31)

Every workflow here was **failing on every run**, and several had *never* succeeded. That is worse
than having no check at all, and not by a little: a row that is always red is a row everyone
learns to skip, so the one time it turns red for a real reason nobody looks. Seven dead checks — six permanently red, one permanently *pending* — were sitting alongside the ones that actually work (`CI`, `Secret scan`, `gitleaks`,
`Vercel`), and the noise was hiding them.

None of these were failing because of a recent change. Each was structurally unable to pass.

| workflow | why it failed | to revive |
|---|---|---|
| `deploy-preview.yml` | Runs `npm run build` with **no env at all**, so a module-level `createClient()` throws `supabaseUrl is required` during page-data collection and the build dies. Fixable in three lines (see the correction below — `ci.yml` builds fine with placeholders). Parked anyway because it is **redundant**: Vercel's own Git integration already builds and deploys previews with real env, and that check (`Vercel`) is green on every PR. | Don't — Vercel already does this. If you ever want it back, copy the placeholder `env:` block from `ci.yml`. |
| `playwright.yml` | **15 runs, 15 failures, never once green.** Three separate blockers: `playwright.config.ts` has no `webServer` and the workflow never starts the app, so every test hits a dead `localhost:3000`; the specs need an authenticated admin session and a seeded `towing-basic` template; and `visual-regression.spec.ts` calls `toHaveScreenshot` with **no baseline images committed**, which fails by definition on a first run. | Real project: add `webServer`, an auth fixture, a seeded test database, and commit baselines. The specs in `tests/` are untouched and still work locally against a running dev server. |
| `deploy-storybook.yml` | `npm error Missing script: "build-storybook"`. Storybook *is* configured (`.storybook/`, `@storybook/react` v9) but the script does not exist in `package.json`. Storybook 9 renamed it to `storybook build`. | Add `"build-storybook": "storybook build"` to `package.json`, then confirm the Vercel deploy step's tokens are set. |
| `sync-to-project.yml` | Uses `actions/add-to-project@v0.5.0` against **Projects (classic)**, which GitHub has deprecated — the API now returns a deprecation notice and the step fails. | Migrate to the new Projects experience and a current version of the action. |
| `release.yml` | **10 runs, 10 failures.** semantic-release dies with `TypeError: Cannot read properties of undefined (reading 'name')` in `@semantic-release/github`. It has never produced a release. | Debug the plugin config. Note the separate `changelog.yml` workflow is green and still generating changelogs, so nothing is currently lost. |
| `visual.yml` | **30 runs, ZERO successes — 24 cancelled, 6 still hanging when this was written.** It never *fails*, it never *finishes*: `run: npm run dev &` backgrounds a server that inherits the step's stdout, so the runner never sees the step close, and with no `timeout-minutes` the job sits until something cancels it. A permanently-**pending** check is worse than a red one — red at least tells you something; pending reads as "still working" forever and stops a PR ever showing all-clear. It also burns runner minutes on every PR for a result nobody ever received. (It has the same missing baselines and missing env as `playwright.yml` underneath, so fixing the hang alone would only convert it to red.) | Start the server with a step that returns (or Playwright's own `webServer`), add `timeout-minutes`, then solve the baselines/env problems from the `playwright.yml` row. |
| `pr-visual-comment.yml` | **This one was green** — and that is the point. All it does is post a comment on every PR saying *"This PR triggers visual regression tests using Playwright… Screenshots will be saved to `tests/__screenshots__/…`"*. With `playwright.yml` and `visual.yml` parked, that sentence is **false**, and it was already misleading before: those tests had never once produced a screenshot. A green bot confidently describing a check that does not run is the same failure as a red check nobody reads, wearing the opposite colour. Parked with the tests it advertises. | Move it back up together with whichever of `playwright.yml` / `visual.yml` is revived, and re-check the wording against what actually runs. |
| `slack-notify.yml`, `slack-visual-alert.yml` | `Error: Need to provide at least one botToken or webhookUrl` — no Slack credentials are configured for this repo. | Add the Slack secret, move the file back up. Trivially revivable. |

## A correction I had to make while writing this

My first draft of this file said the app **cannot build without secrets**, and that ~95 route
modules constructing Supabase clients at module scope was an architectural problem needing a
95-file fix. That was wrong, and wrong in the direction that made the finding sound bigger.

What was actually verified: `deploy-preview.yml` passes **no env at all** to `npm run build`, and
the build dies with `supabaseUrl is required`. Both true. What was *inferred and not checked*:
that this generalises to "the build needs secrets."

It does not. **`ci.yml` builds green on every PR** using three placeholder strings:

```yaml
NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
SUPABASE_SERVICE_ROLE_KEY: placeholder-service-role-key
```

The SDK constructors that genuinely used to throw at module load (Stripe, OpenAI, Resend) were
already made lazy in `lib/lazyClient.ts`. What remains only needs a **non-empty string**, not a
credential. So `deploy-preview.yml` was one three-line `env:` block away from building — it is
parked for **redundancy** with Vercel's own preview deploy, not because it was unfixable.

Worth recording because the mistake has a shape this repo keeps meeting: a true observation plus
an unverified inference, delivered together at one confidence, with the inference running toward
the more dramatic conclusion. The check that would have caught it — "does anything else here
build successfully?" — was one file away the whole time.

## Still worth knowing

Module-level `createClient()` in ~95 route modules is not a build blocker, but it does mean those
routes construct a client at import time whether or not the route is called, and that a genuinely
empty env fails the whole build rather than the one route responsible. Making them lazy is a
tidiness improvement, not the urgent fix this file originally claimed.
