// components/admin/templates/render-blocks/service-transparency.tsx
//
// "Service Transparency (SecondSet)" — a shop's trust block on its OWN site: "we show you
// the work." Pure marketing copy; it never exposes captures (customer proof lives only in
// the per-job portal). Safe to render regardless of the SecondSet pilot flag.

import type { Block } from '@/types/blocks';

export default function ServiceTransparency({ content }: { content?: Block['content'] }) {
  const c: any = content ?? {};
  const headline = (typeof c.headline === 'string' && c.headline.trim()) || 'See the work before you pay for it';
  const blurb =
    (typeof c.blurb === 'string' && c.blurb.trim()) ||
    'Our techs document the actual problem — a photo and a quick note — so you approve the repair before we start.';
  const ctaLabel = typeof c.cta_label === 'string' ? c.cta_label.trim() : '';
  const ctaLink = typeof c.cta_link === 'string' ? c.cta_link.trim() : '';

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
          🔧 Powered by SecondSet
        </span>
        <h2 className="mt-3 text-2xl font-bold md:text-3xl">{headline}</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{blurb}</p>
        <ul className="mx-auto mt-5 grid max-w-lg gap-2 text-left text-sm sm:grid-cols-3">
          <li className="rounded-lg bg-background/60 p-3">📷 <b>See it</b> — a photo of the actual problem</li>
          <li className="rounded-lg bg-background/60 p-3">🎙️ <b>Hear it</b> — the tech explains, in plain terms</li>
          <li className="rounded-lg bg-background/60 p-3">✅ <b>Approve it</b> — before any work happens</li>
        </ul>
        {ctaLabel && ctaLink ? (
          <a href={ctaLink} className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500">
            {ctaLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}
