# Standing up the contributor dev Supabase project

**Maintainer task.** A contributor works against a **separate, non-production Supabase project**
with its own service-role key and seeded data — not against prod. This is why:

QuickSites *is* the backend. ~349 routes in `app/api/**` create service-role clients, so an
anon-only contributor doesn't get a locked-down app, they get one that **renders as though the
database were empty** — `lib/collab/collabs.ts#db()` returns `null` with no key and every read
through it comes back "no rows". Empty-looking is the worst failure shape available: it reads as a
bug in whatever they're working on rather than as a missing credential, so they debug their own
correct code.

Handing over the *production* service-role key is the other obvious resolution, and it is the key
that was committed to this repo once already and had to be rotated
([`SECRET_ROTATION_RUNBOOK.md`](../SECRET_ROTATION_RUNBOOK.md)). A second copy in a second laptop's
`.env.local` is the same risk again, taken deliberately.

## Steps

1. **Create the project.** supabase.com → new project, same org, name it `quicksites-dev`. Free
   tier is sufficient. **Owner action** — it needs the Supabase account, and cannot be scripted
   from a session.

2. **Apply the schema.** From this repo, with `SUPABASE_DB_URL` pointed at the *dev* project:

   ```bash
   SUPABASE_DB_URL='<dev project connection string>' npm run db:migrate:status   # expect: all pending
   SUPABASE_DB_URL='<dev project connection string>' npm run db:migrate:up
   ```

   ⚠️ **Read the URL back before running `up`.** Running the migration ledger against prod because
   a shell still had the old value exported is a mistake with no undo. The `status` call first is
   not ceremony — on a fresh dev project it should report *everything* pending, and if it doesn't,
   you are pointed at the wrong database.

3. **Seed it.** There is dev-seed tooling under `app/api/dev/seed/`. Seed only synthetic
   businesses. ⚠️ **Never copy production rows into it** — that would defeat the entire point;
   the boundary is about the *data*, not the credential.

4. **Hand over `.env.local` values** for the dev project only:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<dev project url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev anon key>
   SUPABASE_SERVICE_ROLE_KEY=<DEV service-role key — never prod's>
   ```

   Everything else stays unset. Stripe, OpenAI, Resend, Twilio, Namecheap and Vercel tokens are
   **not** part of this handover: they are spend-bearing or externally-effecting, and a dev
   database does not make a live payment or a live SMS any less real. Features needing them will
   be off or will fail — that is correct, and [`lib/config/health.ts`](../../lib/config/health.ts)
   reports exactly which at boot, by name, so the contributor can tell "off by design" from
   "broken".

5. **Rotate on offboarding.** When the contributor stops, rotate the dev service-role key. Cheap,
   and it means access ends when the arrangement does rather than whenever someone remembers.

## What this deliberately does not solve

The dev project has **no real data**, which is the point and also the cost: bugs that only appear
against real listings, real imported menus or a real client's template will not reproduce there.
When a contributor hits one, the reproduction is a maintainer's job — do not resolve it by widening
their access.
