'use client';

// components/case-studies/slideshow.tsx
//
// A deck that is also a document. Every slide is rendered into the DOM; the inactive ones are
// hidden with `hidden` rather than unmounted, so the whole thing is crawlable, findable with
// ctrl-F, and prints as pages instead of as one slide and six blanks.
//
// ⚠️ Deep links are the point. The URL carries ?slide=<id>, so a specific slide is shareable —
// including the two that correct the analysis, which is exactly what someone quoting this deck
// back at us should be able to link to. Navigation uses replaceState so a reader's back button
// still leaves the page instead of walking them through seven slides.

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Link2, Check } from 'lucide-react';
import type { Slide } from '@/lib/caseStudies/geminiAgencyEconomics';
import { SOURCE_LABEL } from '@/lib/caseStudies/geminiAgencyEconomics';

const SOURCE_TONE: Record<Slide['source'], string> = {
  gemini: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  reconciliation: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  quicksites: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
};

export default function Slideshow({ slides, shareBase }: { slides: Slide[]; shareBase: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = params?.get('slide');
  const initial = Math.max(0, slides.findIndex((s) => s.id === fromUrl));
  const [i, setI] = React.useState(initial === -1 ? 0 : initial);
  const [copied, setCopied] = React.useState(false);

  const go = React.useCallback(
    (next: number) => {
      const clamped = Math.min(slides.length - 1, Math.max(0, next));
      setI(clamped);
      // replace, not push: the back button should leave, not rewind the deck.
      router.replace(`?slide=${slides[clamped].id}`, { scroll: false });
    },
    [router, slides],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, i]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareBase}?slide=${slides[i].id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the URL bar still has it */
    }
  };

  return (
    <div className="mt-6">
      {/* progress rail */}
      <ol className="flex flex-wrap gap-1.5" aria-label="Slides">
        {slides.map((s, n) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => go(n)}
              aria-current={n === i ? 'step' : undefined}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                n === i
                  ? 'border-sky-400/60 bg-sky-500/15 text-sky-100'
                  : 'border-border bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {n + 1}. {s.nav}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-3 rounded-2xl border border-border bg-card text-card-foreground">
        {slides.map((s, n) => (
          <section
            key={s.id}
            id={`slide-${s.id}`}
            className={n === i ? 'p-6 sm:p-8' : 'hidden print:block print:p-8'}
            aria-hidden={n === i ? undefined : true}
          >
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] ${SOURCE_TONE[s.source]}`}>
              {SOURCE_LABEL[s.source]}
            </span>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{s.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{s.body}</p>

            {s.figures && (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {s.figures.map((f) => (
                  <div key={f.label} className="rounded-xl border border-border bg-muted/40 p-4">
                    <div className="text-xs text-muted-foreground">{f.label}</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{f.value}</div>
                    {f.note && <div className="mt-1 text-xs text-muted-foreground">{f.note}</div>}
                  </div>
                ))}
              </div>
            )}

            {s.points && (
              <ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(i - 1)}
              disabled={i === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => go(i + 1)}
              disabled={i === slides.length - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-400/50 bg-sky-500/15 px-3 py-1.5 text-sm font-medium text-sky-100 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-1 text-xs text-muted-foreground">
              {i + 1} / {slides.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied ? 'Link copied' : 'Copy link to this slide'}
          </button>
        </div>
      </div>
    </div>
  );
}
