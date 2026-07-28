// components/promo/persona-testing-promo.tsx
//
// Cross-promotion for HiveJournal's Persona Testing service — a sibling product in the mesh
// that points AI personas at a live site with a first-time-visitor goal and reports, in the
// persona's own voice, where they got confused.
//
// ⚠️ THE COPY LIVES HERE AND ONLY HERE. Three surfaces render this (publish-success panel,
// admin dashboard, /compare), and the honesty wording below is not decoration — it is the
// thing that keeps the promo truthful. Duplicating the strings into each call site is how
// the rule rots (same reasoning as lib/images/noPeople.ts). Import the component; never
// hand-write "AI personas browse your site…" anywhere else.
//
// ── THE HONESTY LINE (network standard) ──────────────────────────────────────────────────
// These are AI personas. They browse "the way a real customer WOULD" — never "as real
// people" and never "with real people", both of which assert that humans did the testing.
// They didn't. Selling AI output as human testing inverts the same standard the mesh
// ratified for narrated audio (voice_basis) and generated imagery (rule 9). The honest
// version is also the stronger wedge: it is checkable, and the price reflects it.
//
// We also name HiveJournal explicitly. A site owner clicking through lands on a different
// product with its own account and billing; letting that read as a QuickSites feature would
// be a small deception that costs trust the first time they notice.
import Link from 'next/link';

/** Canonical destination. `ref` is attribution only — no rev-share; it's an owner-internal
 *  cross-promotion between two products the same person owns. */
export const PERSONA_TESTING_URL = 'https://www.hivejournal.com/persona-testing?ref=quicksites';

/** The one approved description. Read the honesty note above before editing a word of it. */
export const PERSONA_TESTING_COPY = {
  eyebrow: 'Partner product · HiveJournal',
  headline: 'See where a first-timer gets stuck',
  body:
    'AI personas — each with a backstory and a goal — browse your site the way a real customer would, then tell you in their own words what confused them.',
  disclosure: 'AI personas, not human testers.',
  price: 'Free tier, no card.',
  cta: 'Try it free',
} as const;

type Variant = 'panel' | 'card' | 'inline';

export default function PersonaTestingPromo({ variant = 'card' }: { variant?: Variant }) {
  const c = PERSONA_TESTING_COPY;

  // Marketing pages: a quiet related-link, no card chrome.
  if (variant === 'inline') {
    return (
      <div className="text-sm">
        <p className="text-zinc-400">
          <span className="font-medium text-zinc-200">{c.headline}.</span> {c.body}{' '}
          <span className="text-zinc-500">
            {c.disclosure} {c.price}
          </span>
        </p>
        <Link
          href={PERSONA_TESTING_URL}
          target="_blank"
          rel="noopener"
          className="mt-2 inline-block text-emerald-300 underline underline-offset-4 hover:text-emerald-200"
        >
          {c.cta} at HiveJournal →
        </Link>
      </div>
    );
  }

  // panel = post-publish (highest intent: they just shipped and want to know if it works).
  // card  = admin dashboard (persistent, reaches owners whose sites are already live).
  const compact = variant === 'panel';

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 text-left">
      <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-400/80">
        {c.eyebrow}
      </p>
      <h4 className="mt-1 text-sm font-semibold text-white">
        <span aria-hidden className="mr-1.5">
          🎭
        </span>
        {c.headline}
      </h4>
      <p className="mt-1.5 text-sm text-zinc-400">{c.body}</p>
      <p className="mt-1.5 text-xs text-zinc-500">
        {c.disclosure} {c.price}
      </p>
      <Link
        href={PERSONA_TESTING_URL}
        target="_blank"
        rel="noopener"
        className={`mt-3 inline-block rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 font-medium text-emerald-200 transition hover:bg-emerald-500/20 ${
          compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
        }`}
      >
        {c.cta} →
      </Link>
    </div>
  );
}
