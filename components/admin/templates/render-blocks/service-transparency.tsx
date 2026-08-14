// components/admin/templates/render-blocks/service-transparency.tsx
//
// "Service Transparency (SecondSet)" — the trust block on an auto shop's own site.
//
// ⚠️ TWO VOICES, AND PICKING THE WRONG ONE IS A CLAIM ABOUT SOMEONE ELSE'S BUSINESS.
// This block used to say, unconditionally: "🔧 Powered by SecondSet — Our techs document the actual
// problem … so you approve the repair before we start." First person, present tense, on pages we
// auto-build for shops that have never heard of SecondSet and could not use it if they wanted to
// (the pilot is behind SECONDSET_ENABLED, and nobody is enrolled).
//
// That is the same failure as the scaffold FAQ asserting a stranger was "fully licensed and
// insured" (#787): a promise a customer can rely on, made on behalf of someone who never made it.
// Worse here, because a driver could choose this shop expecting to approve photos before work.
//
// So the voice follows `enrolled`:
//   enrolled: true  → first person. The shop opted in; "our techs" is theirs to say.
//   otherwise       → third person INVITATION. Describes what SecondSet is, says the shop is
//                     eligible, and says plainly that it is not switched on. Never implies the
//                     shop uses it, and never implies they must.
//
// ⚠️ DEFAULTS TO NOT-ENROLLED. The safe voice must be the one you get by forgetting to set the
// flag — the failure mode of the opposite default is a false claim on a real business's page.
import type { Block } from '@/types/blocks';

export default function ServiceTransparency({
  content,
  template,
  businessName,
}: {
  content?: Block['content'];
  /** The render site — blocks already receive this, so no renderer change is needed. */
  template?: any;
  /** Explicit override, used by tests. Falls back to the template, then "This shop". */
  businessName?: string | null;
}) {
  const c: any = content ?? {};
  const enrolled = c.enrolled === true;
  // ⚠️ `data.meta.business_name` is the one that is actually populated on a listing-import draft
  // (verified against a live row); the top-level `business_name` is not carried into the render
  // object. Naming the shop matters here — "This shop is eligible" reads like a template, and the
  // whole point of this voice is that it is a specific, checkable statement about them.
  const fromTemplate =
    template?.business_name ??
    template?.data?.meta?.business_name ??
    template?.meta?.business_name ??
    null;
  const shop =
    (typeof businessName === 'string' && businessName.trim()) ||
    (typeof fromTemplate === 'string' && fromTemplate.trim()) ||
    'This shop';

  const headline =
    (typeof c.headline === 'string' && c.headline.trim()) || 'See the work before you pay for it';

  const blurb =
    (typeof c.blurb === 'string' && c.blurb.trim()) ||
    (enrolled
      ? 'Our techs document the actual problem — a photo and a quick note — so you see it and approve the repair before we start. No surprises, no “trust us.”'
      : `SecondSet is a pilot that lets a shop show you the actual problem — a photo and a plain-language note — so you approve the repair before it starts. ${shop} is eligible to join. It isn’t switched on yet, and it’s optional.`);

  const ctaLabel = typeof c.cta_label === 'string' ? c.cta_label.trim() : '';
  const ctaLink = typeof c.cta_link === 'string' ? c.cta_link.trim() : '';
  // Not-yet-enrolled always offers the explainer, so a curious driver (or the owner reading their
  // own page) can find out what the badge means rather than assuming it is already running.
  const showDefaultCta = !enrolled && !(ctaLabel && ctaLink);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          {enrolled ? '🔧 Powered by SecondSet' : '🔧 Eligible for the SecondSet pilot'}
        </span>
        <h2 className="mt-3 text-2xl font-bold md:text-3xl">{headline}</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{blurb}</p>

        {/* ⚠️ The three steps describe SECONDSET, not this shop's current practice — so when the
            shop has not enrolled they are labelled as how it would work, not what happens today. */}
        {!enrolled && (
          <p className="mt-5 text-xs uppercase tracking-widest text-muted-foreground">How it would work</p>
        )}
        <ul className={`mx-auto grid max-w-lg gap-2 text-left text-sm sm:grid-cols-3 ${enrolled ? 'mt-5' : 'mt-2'}`}>
          <li className="rounded-lg bg-background/60 p-3">📷 <b>See it</b> — a photo of the actual problem</li>
          <li className="rounded-lg bg-background/60 p-3">🎙️ <b>Hear it</b> — the tech explains, in plain terms</li>
          <li className="rounded-lg bg-background/60 p-3">✅ <b>Approve it</b> — before any work happens</li>
        </ul>

        {ctaLabel && ctaLink ? (
          <a
            href={ctaLink}
            className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            {ctaLabel}
          </a>
        ) : showDefaultCta ? (
          <a
            href="/secondset"
            className="mt-6 inline-block rounded-lg border border-emerald-500/40 px-5 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10"
          >
            What is SecondSet? →
          </a>
        ) : null}
      </div>
    </section>
  );
}
