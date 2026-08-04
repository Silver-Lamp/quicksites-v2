# QuickSites — contributor onboarding

Getting-started checklist for a contributor working on **QuickSites** (Next.js 15 App Router,
Supabase, Vercel).

> **Before your first commit:** sign the
> [VOLUNTEER_CONTRIBUTOR_AGREEMENT.md](VOLUNTEER_CONTRIBUTOR_AGREEMENT.md).

Companions: [`CLAUDE.md`](../../CLAUDE.md) is the orientation doc — read it first, it is written
for exactly this moment. [`docs/DEVELOPMENT.md`](../DEVELOPMENT.md) has the full local setup.

---

## 1. Access

You get **`write` on `Silver-Lamp/quicksites-v2`** — direct repo access, so you clone and work on
branches rather than from a fork. The repo is **public**, so cloning never needed the grant; the
grant is about pushing.

## 2. Clone and run

```bash
nvm use                       # Node 20 — the repo pins it, and CI/tooling assumes it
npm install
cp .env.example .env.local    # a maintainer gives you the values — see §3
npm run dev                   # http://localhost:3000
```

If `npm run build` fails on `canvas.node … NODE_MODULE_VERSION`, run `npm rebuild canvas`.

Quality gates, all of which should pass before you open a PR:

```bash
npm run typecheck             # tsc --noEmit — this is green, keep it green
npm run lint
npm run test                  # playwright e2e
```

## 3. The secrets boundary — read this, it is different from our sibling projects

**What you are given:**

| variable | why it's safe |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public client config; ships in the browser bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public by design, RLS-gated |

**What you are never given, must never ask for, and must never commit or paste anywhere:**
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`OPENAI_API_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, Twilio, Namecheap, Vercel tokens — every server
secret stays with maintainers. `.env.local` is gitignored; keep it that way. A `gitleaks` scan runs
in CI **and** as a pre-commit hook, because a service-role key was committed to this repo once
before and had to be rotated (see [`SECRET_ROTATION_RUNBOOK.md`](../SECRET_ROTATION_RUNBOOK.md)).

### ⚠️ Why this repo cannot copy HiveJournal's arrangement, and what that means for you

On the HiveJournal mobile app a contributor runs a **client** against a maintainer-run backend, so
the anon key is genuinely enough. **QuickSites is the backend.** ~349 API routes live in
`app/api/**` and most of them create a service-role Supabase client; without that key they don't
fail loudly, they return empty — e.g. `lib/collab/collabs.ts#db()` returns `null` with no key, and
every read through it comes back as "no rows". So a contributor with anon-only credentials gets an
app that **renders as though the database were empty**, which looks like a bug in whatever you are
working on rather than a missing key.

**The intended arrangement is a separate dev Supabase project** — its own non-production
service-role key, its own seeded data, no access to real business records. You work full-stack and
nothing you can reach is a real client's. Standing one up is a maintainer task:
[`DEV_SUPABASE_PROJECT.md`](DEV_SUPABASE_PROJECT.md).

⚠️ **As of 2026-08-04 that project does not exist yet, so the current arrangement is
frontend-scoped, anon-only** — components, public pages, block renderers, styling. Ask the
maintainer which applies to you rather than inferring it from this paragraph; a doc describing the
intended end state as though it were today's is exactly how someone spends an afternoon debugging
a missing credential.

**On anon-only, admin and commerce surfaces render as though the database were empty. That is
expected, not a bug in whatever you are working on.** It is the most confusing thing about this
codebase for a new person, because nothing errors — see the note above on service-role clients
returning empty rather than failing. If something you are *supposed* to be able to see is empty,
that is a question for the maintainer, not a bug to work around.

**Production credentials** are maintainers only, in every arrangement.

## 4. What is off-limits, and how it is enforced

| | how it's actually enforced |
|---|---|
| Privileged prod writes | **absence of the service-role key** — not a policy, a missing capability |
| Database migrations | owner-applied. `npm run db:migrate:up` needs `SUPABASE_DB_URL`, which you don't have. Still **write** the migration file in your PR — see below |
| Deploys | Vercel deploys on merge to `main`; a write contributor can't trigger one without a merge landing |
| Publishing client sites | operator surfaces, admin-gated |
| The crosstalk mailbox (`_SilverLamp/crosstalk`) | not a contributor surface — it's the cross-product session mesh |

**Real business data.** Unlike a greenfield project, this database holds real named businesses,
imported public listings, client site drafts, customer records and order history. Confidentiality
(§4 of the agreement) is not boilerplate here. Never copy production data out, and never test
against a real client's records — see [`CUSTOM_SITES.md`](../CUSTOM_SITES.md) §7b, where test
messages twice landed in a real client's thread, once attributed to her.

## 5. Workflow

- **Branch off `main`**, small descriptive commits, push the branch, open a PR.
- **Conventional commits** — `npm run commit` walks you through it, and commitlint enforces it.
- Merge with **`gh pr merge --squash`**.
- **`main` requires a PR with one approval**, and rejects force-pushes, deletions and merge
  commits (a GitHub *ruleset*, added 2026-08-04 when the repo went from one writer to two). So you
  cannot push to `main`, and you will need a maintainer's review to land anything — that is the
  intended shape, not a misconfiguration. ⚠️ Note for anyone auditing this later:
  `GET /branches/main/protection` returns **404 even now**, because that endpoint does not see
  rulesets. Check `GET /rulesets`.
- Migrations: add the `supabase/migrations/<ts>_name.sql` file to your PR with idempotent DDL
  (`if [not] exists`) and say in the PR body that it is unapplied. A maintainer runs it.
- **Keep `tsc --noEmit` green** and read [`CLAUDE.md`](../../CLAUDE.md) §7 before styling anything:
  the app chrome is always dark, and hard-coded light utilities produce invisible text that no test
  catches — only a screenshot does.

## 6. Before you open your first PR

Read [`CLAUDE.md`](../../CLAUDE.md) §9. The house rule that matters most is **say which half you
checked** — separate what you verified from what you inferred, and label the inference that
supports your conclusion. A wrong observation fails loudly; a wrong inference fails silently and
gets built on.
