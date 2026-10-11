// components/for-rep/vertical-flow.tsx
//
// A flowchart for one vertical on a sales page: the steps the salesperson takes, who acts at
// each one, and the result at the end. Server-rendered HTML, no client bundle; reads on the
// dark chrome. Copy comes from lib/rep/verticalFlows.ts and nowhere else.
//
// ⚠️ Redesigned 2026-10-10 (owner). The first cut was seven boxes in a row: inside the page's
// reading column each box was ~75px wide, one word per line, and the row ran taller than the
// viewport. A sequence of six things a person does reads as a TIMELINE — numbered rows down a
// rail, one line of title and two of detail each — and the result sits beside it on a desktop
// so "what you do" and "what you get" are on screen together. Fits the 3xl column; no bleed.
import { VERTICAL_FLOWS, WHO_LABEL, type FlowWho, type VerticalFlow as Flow } from '@/lib/rep/verticalFlows';

const TONE: Record<FlowWho, { dot: string; chip: string; ring: string }> = {
  rep: { dot: 'bg-sky-400', chip: 'border-sky-500/40 bg-sky-500/10 text-sky-200', ring: 'ring-sky-400/40' },
  business: { dot: 'bg-zinc-400', chip: 'border-zinc-600 bg-zinc-800 text-zinc-300', ring: 'ring-zinc-500/40' },
  auto: { dot: 'bg-teal-400', chip: 'border-teal-500/40 bg-teal-500/10 text-teal-200', ring: 'ring-teal-400/40' },
};

export default function VerticalFlow({ flow }: { flow: Flow | Flow['key'] }) {
  const f = typeof flow === 'string' ? VERTICAL_FLOWS[flow] : flow;
  return (
    <figure className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 sm:p-5" data-vertical-flow={f.key}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{f.caption}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
          {(['rep', 'business', 'auto'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${TONE[k].dot}`} />
              {WHO_LABEL[k]}
            </span>
          ))}
        </span>
      </figcaption>

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] md:gap-6">
        {/* The rail: one numbered row per step, a line joining the dots. */}
        <ol className="relative ml-3 border-l border-zinc-800 pl-6">
          {f.steps.map((s, i) => (
            <li key={s.title} className={i === f.steps.length - 1 ? 'relative' : 'relative pb-5'}>
              <span
                aria-hidden
                className={`absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-zinc-950 ${TONE[s.who].dot}`}
              >
                <span className="text-[10px] font-bold leading-none text-zinc-950">{i + 1}</span>
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-white">{s.title}</span>
                <span className={`rounded-full border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${TONE[s.who].chip}`}>
                  {WHO_LABEL[s.who]}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.detail}</p>
            </li>
          ))}
        </ol>

        {/* The result, beside the rail on a desktop, after it on a phone. */}
        <aside className="rounded-xl border border-emerald-500/40 bg-emerald-500/[0.08] p-4 md:sticky md:top-24 md:self-start">
          <div className="flex items-center gap-2">
            <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-bold text-zinc-950">✓</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">What you get</span>
          </div>
          <p className="mt-2 text-base font-semibold leading-snug text-white">{f.result.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{f.result.detail}</p>
        </aside>
      </div>
    </figure>
  );
}
