// components/compare/case-study-callout.tsx
//
// The Gemini case study on the compare cluster — two surfaces, one data source.
//
//   <CaseStudyEconomicsSection />        the hub's "agency economics" axis (/compare)
//   <CaseStudyVendorCallout slug=… />   the per-competitor aside (/compare/10web, /compare/framer)
//
// /compare is a FEATURE grid; the deck is agency UNIT ECONOMICS (what a retainer leaves after
// licence + labour). That axis was missing from /compare, so this promotes the deck there.
// Three rules, all inherited from lib/caseStudies/geminiAgencyEconomics:
//   1. Every figure is READ from the slide registry — never retyped here — so this cannot quote
//      a number the deck no longer shows.
//   2. Gemini's figures are labelled Gemini's, in the tile, not in a footnote.
//   3. The corrections travel WITH the headline. A section that shows the margin figure and hides
//      the three slides that qualify it is the invented-testimonial failure with extra steps.
//   (A test greps these files for the deck's literal figures — including this comment.)
// Stat tiles, not a chart: three headline numbers with no series — values wear the text tokens
// and the label carries identity.

import Link from 'next/link';
import {
  CASE_STUDY_COMPETITORS,
  CASE_STUDY_PATH,
  SOURCE_LABEL,
  buildSlides,
  caseStudyCorrections,
  caseStudyFiguresFor,
} from '@/lib/caseStudies/geminiAgencyEconomics';

function SourceTag({ kind }: { kind: keyof typeof SOURCE_LABEL }) {
  const tone =
    kind === 'gemini'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {SOURCE_LABEL[kind]}
    </span>
  );
}

/** The hub section: the headline margins as Gemini modelled them, then the corrections. */
export function CaseStudyEconomicsSection() {
  const slides = buildSlides();
  const headline = slides.find((s) => s.id === 'headline');
  const corrections = caseStudyCorrections();
  if (!headline?.figures?.length) return null;

  return (
    <section id="agency-economics" className="mx-auto max-w-5xl scroll-mt-24 px-6 py-10">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Agency economics · a third-party analysis
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">What an agency actually keeps</h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          The grid below compares features. Google’s Gemini compared something else: what a
          maintenance retainer leaves after licence fees and labour, across QuickSites, 10Web and
          Framer. It put us first. We published it with its seams showing — read the corrections
          before you quote the headline.
        </p>

        {/* Gemini's headline — three stat tiles, labelled as its model */}
        <div className="mt-6">
          <SourceTag kind="gemini" />
          <p className="mt-3 text-sm text-zinc-300">{headline.title}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {headline.figures.map((f) => (
              <div key={f.label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {f.label}
                </div>
                <div className="mt-1 text-3xl font-bold tracking-tight text-white">{f.value}</div>
                {f.note ? <div className="mt-1 text-xs text-zinc-500">{f.note}</div> : null}
              </div>
            ))}
          </div>
          {headline.points?.[0] ? (
            <p className="mt-3 text-xs text-zinc-500">{headline.points[0]}</p>
          ) : null}
        </div>

        {/* Our corrections — never behind a click */}
        <div className="mt-8">
          <SourceTag kind="reconciliation" />
          <h3 className="mt-3 text-base font-semibold text-white">
            Read these before you quote it
          </h3>
          <ol className="mt-3 grid gap-3 md:grid-cols-3">
            {corrections.map((c, i) => (
              <li
                key={c.id}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4"
              >
                <div className="text-xs font-medium text-emerald-300">
                  {i + 1}. {c.title}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{c.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href={CASE_STUDY_PATH}
            className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
          >
            Read the full case study →
          </Link>
          {Object.entries(CASE_STUDY_COMPETITORS).map(([slug, v]) => (
            <Link
              key={slug}
              href={`/compare/${slug}`}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              QuickSites vs {v.label}
            </Link>
          ))}
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          10Web’s and Framer’s pricing on this site was read from their own pricing pages by us; the
          margins and labour hours above are Gemini’s model and we have not verified them.
        </p>
      </div>
    </section>
  );
}

/** The per-competitor aside. Renders nothing for a competitor the analysis did not model. */
export function CaseStudyVendorCallout({ slug }: { slug: string }) {
  const f = caseStudyFiguresFor(slug);
  if (!f) return null;
  const rows = [
    { label: 'Gross margin on a $199 retainer', ours: f.margin.ours, theirs: f.margin.theirs },
    ...(f.payback
      ? [{ label: 'Payback on a $0-down site', ours: f.payback.ours, theirs: f.payback.theirs }]
      : []),
  ];
  return (
    <section className="mx-auto max-w-4xl px-6 py-4">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">In the Gemini case study</h2>
          <SourceTag kind="gemini" />
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Google’s Gemini modelled agency unit economics for QuickSites against {f.label}. Its
          figures, quoted as it produced them — our corrections are on the deck itself.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {r.label}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-zinc-500">QuickSites</dt>
                  <dd className="text-xl font-bold text-white">{r.ours.value}</dd>
                  {r.ours.note ? (
                    <dd className="text-[11px] text-zinc-500">{r.ours.note}</dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">{f.label}</dt>
                  <dd className="text-xl font-bold text-white">{r.theirs.value}</dd>
                  {r.theirs.note ? (
                    <dd className="text-[11px] text-zinc-500">{r.theirs.note}</dd>
                  ) : null}
                </div>
              </dl>
            </div>
          ))}
        </div>
        <Link
          href={CASE_STUDY_PATH}
          className="mt-4 inline-flex text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Read the case study, corrections included →
        </Link>
      </div>
    </section>
  );
}
