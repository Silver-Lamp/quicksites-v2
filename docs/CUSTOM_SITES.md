# Custom Sites — hosting a real business on QuickSites, by hand

> How to build and publish a **custom site for a named client** — a real person, a real company,
> a real commercial arrangement — as opposed to a generated demo, a listing import, or a guest
> build. Written from doing it (GracePoint Collective, 2026-08-02) and from the things that
> silently went wrong on the way.
>
> Companion: [`CLAUDE.md`](../CLAUDE.md) §5 (the two core flows) · §7 (conventions) · §9 (how to
> report what you checked).

---

## 1. What makes a site "custom"

| kind | `claim_source` | copy written by | honesty posture |
|---|---|---|---|
| generated demo | `demo_seed` | an LLM, business is fictional | invented business, so invented copy is fine — but **no fake reviews or staff**, they read as real |
| listing import | `listing_import` | scraped from a public listing | a **real named business that never asked us** — the strictest bar |
| guest build | `guest_build` | the visitor | theirs |
| **custom site** | `operator_draft` | **us, about a real client** | every claim traces to a source the client supplied, and they see it before it matters |

A custom site is the only kind where **we write first-person copy about a real person's career and
commercial arrangements.** That is the whole risk surface, and §4 is about nothing else.

---

## 2. The build path that works

`buildIndustryStarter` gives structure and theme; you supply the words.

```ts
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

const tpl: any = buildIndustryStarter({ businessName: 'Acme Advisory', industryKey: 'personal' });
const page = tpl.data.pages[0];
```

### ⚠️ Trap 1: the scaffold does not ship the blocks you assume

The `personal` scaffold emits `hero · story · voice_welcome · audio_faq · cta · contact_form`.
**No `services`. No `faq`.** So this silently does nothing:

```ts
const services = page.blocks.find(b => b.type === 'services');  // undefined
services.content.items = [...];                                  // ✗ never runs, no error
```

The first GracePoint build produced a **three-block site** this way and reported success. There is
no error because assigning into a lookup that returned `undefined` inside optional chaining just
evaporates.

**Do this instead** — create what you need and assemble the order explicitly:

```ts
const services: any = createDefaultBlock('services');
const faq: any = createDefaultBlock('faq');
// …set content…
const blocks = [hero, services, story, faq, contact].filter(Boolean);
page.blocks = blocks;
page.content_blocks = blocks;   // ⚠️ BOTH. See trap 2.
```

### ⚠️ Trap 2: `blocks` and `content_blocks` are two copies of one truth

Different code paths read different arrays. The publish snapshot reads `content_blocks`. A repair
that updated only `blocks` produced a template that looked fixed in the DB and republished the
damage. **Always write both.**

### ⚠️ Trap 3: print what you built

```ts
console.log(JSON.stringify({ blocks: page.blocks.map(b => b.type) }));
```

One line, and it is the difference between "five blocks in the right order" and discovering three
of them evaporated. Every silent failure in this doc was caught by printing rather than assuming.

### ⚠️ Trap 4: a block's content can lose to the template's, silently

`render-blocks/services.tsx` resolves its items in this order:

```
template.data.services  →  a prop  →  the template row  →  block.content.items
```

The block's own content is **last**. So a custom site built on an industry scaffold renders the
scaffold's generic offer list — *Consulting / Installation / Support / Upgrades / Maintenance* —
in place of the copy written for the block, and the block content still reads correctly in the DB,
in the editor, and in every check that inspects blocks. Two of Amy's three live variants shipped
this way; nobody noticed until a **screenshot** was taken.

The fix is to clear `data.services` (and `meta.services`, and the `services` column) on a custom
site that isn't selling a scaffolded service list. The general lesson is Trap 2 again in a new
costume: **two copies of one truth, and the one you didn't write wins.** Before assuming a block
renders what you gave it, read the renderer's resolution order.

And the reason this stayed invisible is worth naming separately: every verification up to that
point read the *inputs*. Only rendering the page compared them to the *output*.

### Inserting

Service-role insert; `INSERT` is not trigger-guarded (`UPDATE` is — see §5).

```ts
await db.from('templates').insert({
  id: crypto.randomUUID(),
  template_name: 'Acme Advisory',
  slug: tpl.slug,
  data: tpl.data,
  color_mode: tpl.color_mode ?? 'dark',
  header_block: tpl.data?.headerBlock ?? null,
  footer_block: tpl.data?.footerBlock ?? null,
  is_site: false,
  industry: 'personal',
  business_name: 'Acme Advisory',
  claim_source: 'operator_draft',
});
```

### Running the script

Two environment traps, both cost a debugging cycle:

- **Run it from inside the repo.** A script in `/tmp` cannot resolve `@supabase/supabase-js` or
  the `@/` alias. Put it in `scripts/` (delete after) rather than fighting module resolution.
- **Node 22, not 20.** The realtime client needs native WebSocket; Node 20 throws
  `Node.js 20 detected without native WebSocket support`.

---

## 3. Publishing

**`published_sites` is the truth. `templates.published` is not.** The renderer serves whatever the
`published_sites` pointer references and ignores `published`, `archived`, `is_public` and `status`
alike. A template can read `published: false` and still serve; an archived one can still serve.

- publish / republish → `publish_template_demo` RPC (mints a fresh snapshot)
- an unpublished draft renders **`Loading…` with no content** to an anonymous visitor. **That is
  expected, not a bug** — do not go hunting an SSR regression when the real answer is "nobody
  published it."
- editing `templates.data` changes nothing live until you republish. Commit ≠ publish.

---

## 4. The honesty rules for a client's site

These are not style preferences. Each one was learned by finding its violation shipped.

1. **Every claim traces to a source the client supplied.** Roles, dates, numbers. Keep the source
   (a LinkedIn export, a PDF, an email) so a disputed line can be answered.
2. **Third-party claims stay attributed.** If a supplier says "20–50% cheaper", the page says *they*
   say it — *"that is their figure, not mine"* — never the client's voice asserting it.
3. **Never assert what the supplier does not claim.** The GracePoint brief described a "renewable
   powered" pitch; the supplier's own site says **renewable zero times** and leads on cost. Building
   the renewable angle would have manufactured a positioning nobody stood behind. **Read the
   supplier's actual site before writing the client's.**
4. **No invented testimonials, staff, or photographs.** A new client has no reviews yet; an empty
   testimonial block that renders nothing publicly is correct. (Rule 9, no generated people:
   `lib/images/noPeople.ts`.)
5. **Disclose the commercial arrangement, early and unprompted.** If the client is paid by referral,
   say so in the first FAQ. It is a credibility asset for anyone whose offer is "trust my
   introduction" — but it is **their** arrangement to disclose, so flag the wording for them.
6. **Editor-speak never reaches visitors.** "No services configured", "Map unavailable", "No social
   links yet" — gate on `isEditorContext()`. See `components/site/bill-redaction-review.tsx` for
   the pattern.

---

## 5. Editing a live custom site

Direct `UPDATE`s to `templates` are trigger-blocked (`app.guard_templates_update`). Go through
`lib/templates/commitTemplatePatch.ts`, then republish.

---

## 6. Client-specific interactive blocks

A custom site often needs one thing the block library doesn't have. GracePoint needed "upload your
cloud bill, get an estimate". The shape that worked, reusable:

- **`lib/billing/redactBill.ts`** — pure detection + redaction, no I/O, fully testable
- **`components/site/bill-redaction-review.tsx`** — client component: extract → review → send
- **`lib/billing/estimateSavings.ts`** — the metered model call
- **`app/api/billing/estimate/route.ts`** — flag-gated, rate-limited, re-redacts server-side

**The transferable rule: do the sensitive work in the browser, before anything is sent.** "Upload
it and we'll strip the private parts" is strictly worse than stripping it client-side, because to
strip it you must first receive it — it converts a fact into a policy, and a policy is a thing the
user is asked to trust. Then **re-run the same check server-side**, so the guarantee survives an
old client, an edited one, or `curl`.

---

## 6b. Two patterns, and when each is right

We have now built custom sites two different ways. Neither is wrong; they fail differently.

| | **compose standard blocks** (GracePoint, 2026-08) | **one bespoke whole-page block** (PNW Prestige, 2025-10) |
|---|---|---|
| shape | `hero · services · story · faq · contact` from the library | a single `exterior_agency` block, 556 lines |
| client can edit | yes, every block has an editor | yes — it shipped its own `exterior-agency-editor.tsx` |
| design control | bounded by the block library | total |
| inherits fleet fixes | **yes** — SSR fix, footer fixes, backdrops, honesty gates all landed on it for free | **no** — a private component improves only when someone remembers it exists |
| swept by the guards | yes | **no, until 2026-08-02** — see below |

**Default to composing.** The bespoke block is right when a vertical genuinely needs a layout the
library cannot express, and you accept that it is now a permanent maintenance item.

### ⚠️ Bespoke blocks escaped both fleet-wide guards

`exterior_agency` lives in `components/sites/render-blocks/`. Both sweeps — the editor-hint leak
test and the SectionShell hard-coded-colour test — scanned only
`components/admin/templates/render-blocks/`. So the file **most likely** to hard-code a colour (it
was designed against one client's palette, not the theme tokens) was the one file neither guard
looked at.

That block happened to be clean. The hole was not. Both sweeps now scan **both** directories, and
each asserts it actually covered the second one — because *"a scan scoped by directory misses
whatever someone puts in the folder next door"*, and an assertion that the scope is real is the
only thing that catches it.

### ⚠️ Tag custom sites, or they become invisible

`pnw-exteriorcleaning` carries **`claim_source: null`**. Every query that reasons about site
provenance — the demo-cohort feed, the retire script, a future Custom Sites dashboard — filters on
`claim_source`, so an untagged custom site is invisible to all of them. It is findable only by
someone who already remembers it exists, which is exactly what happened here.

**Always set `claim_source: 'operator_draft'`** on a custom build.

*(Also worth knowing: PNW is no longer serving — 0 `published_sites` rows, retired in the
2026-07-30 stale-site sweep. `templates.archived` was still `false`, which is the same
archiving-does-not-unpublish trap documented in §3, seen from the other side.)*

---

## 7. Verification checklist

Run all of these. Each catches a failure that has actually shipped.

```bash
# 1. Did the blocks you think you built actually exist?
#    (prints the block list — catches the silent no-op from trap 1)

# 2. Honesty sweep over the built JSON
grep -iE 'testimonial|satisfied client|★|renewable' template.json   # expect: nothing you didn't intend

# 3. Dark-chrome guard on any new component (CLAUDE.md §7)
grep -nE 'text-zinc-(700|800|900)|bg-white(\b[^/-]|$)|border-zinc-(200|300)|bg-(zinc|slate|gray)-(50|100)(\b[^/-]|$)' <file>

# 4. Does it SERVER-RENDER? (post-#673 — this was broken fleet-wide)
curl -s https://<slug>.quicksites.ai/ | grep -c '<h1'    # expect >= 1, NOT 0

# 5. Does the RENDERED page contain the copy you wrote? (trap 4)
#    Not the block JSON — the served HTML. This is the only check that compares
#    what you wrote against what a visitor is shown.
curl -s https://<slug>.quicksites.ai/ | grep -c '<a phrase you wrote>'   # expect >= 1
```

⚠️ **Grep the HTML for a whole phrase, not a phrase containing a value.** React splits
`Option {letter}` into separate text nodes and inserts `<!-- -->` between them, so
`grep 'Option A'` returns zero on a page that plainly says *Option A*. Two "bugs" in this doc's
history were the grep being wrong, not the page. When a check fails, suspect the check first.

⚠️ **Check the instance the claim is about** (CLAUDE.md §9 2b). Testing the marketing pages told us
SSR was fine while every customer site served an empty shell. A clean result only clears what you
actually sampled.

⚠️ **Look at the live page in a browser.** Two bugs this week were invisible to `tsc` and to every
test: white-on-white text from a shared component's default, and a person's biography published as
raw JSON.

---

## 8. Toward a Custom Sites dashboard

The manual path above is the specification. A dashboard would wrap it as:

1. **Intake** — client name, industry, source material (LinkedIn/PDF/URL), supplier links.
2. **Source review** — show what was extracted and **what it did not yield**, the Verbatim `gaps`
   pattern. A builder that reports only what it found lets you publish a page missing something.
3. **Compose** — block picker with the scaffold as a starting point, not a cage (trap 1 is a
   dashboard bug waiting to happen: the UI must show which blocks exist rather than assume).
4. **Honesty gate before publish** — the §7 checks as blocking status, plus an explicit
   "attributed / unattributed" flag on any third-party claim in the copy.
5. **Client review link** — a share URL that is not the editor, so a client can read it without an
   account. Today this is a manual step and the weakest part of the flow.
6. **Publish + verify** — republish, then automatically re-run the SSR check and show the h1/link
   counts. Publishing a site that renders nothing is the failure mode worth designing against.

The dashboard's real job is **making the checklist in §7 unskippable**, because every item on it
was learned by shipping its absence.
