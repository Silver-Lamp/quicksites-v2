// components/for-rep/vertical-flow.tsx
//
// A flowchart for one vertical on a sales page: the steps the salesperson takes, who acts at
// each one, and the result at the end. Server-rendered HTML, no client bundle; reads on the
// dark chrome; stacks on a phone and runs left to right on a desktop. Copy comes from
// lib/rep/verticalFlows.ts and nowhere else.
import { VERTICAL_FLOWS, WHO_LABEL, type FlowWho, type VerticalFlow as Flow } from '@/lib/rep/verticalFlows';

const TONE: Record<FlowWho, { box: string; tag: string; dot: string }> = {
  rep: { box: 'border-sky-500/35 bg-sky-500/[0.06]', tag: 'text-sky-300', dot: 'bg-sky-400' },
  business: { box: 'border-zinc-700 bg-zinc-900/60', tag: 'text-zinc-400', dot: 'bg-zinc-400' },
  auto: { box: 'border-teal-500/35 bg-teal-500/[0.06]', tag: 'text-teal-300', dot: 'bg-teal-400' },
};

export default function VerticalFlow({ flow }: { flow: Flow | Flow['key'] }) {
  const f = typeof flow === 'string' ? VERTICAL_FLOWS[flow] : flow;
  // Full-bleed like the restaurants table: seven boxes in the page's 3xl column were 75px wide
  // on a desktop (one word per line, boxes taller than the viewport). Capped at 1400px; on a
  // mid-size screen the row wraps rather than squeezing.
  return (
    <figure className="relative left-1/2 mt-4 w-[min(100vw_-_2rem,1400px)] -translate-x-1/2" data-vertical-flow={f.key}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{f.caption}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
          {(['rep', 'business', 'auto'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${TONE[k].dot}`} />
              {WHO_LABEL[k]}
            </span>
          ))}
        </span>
      </figcaption>
      <ol className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-stretch">
        {f.steps.map((s, i) => (
          <li key={s.title} className="flex flex-col md:min-w-[190px] md:flex-1 md:flex-row md:items-stretch">
            <div className={`flex-1 rounded-lg border p-3 ${TONE[s.who].box}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${TONE[s.who].tag}`}>
                {i + 1} · {WHO_LABEL[s.who]}
              </div>
              <div className="mt-1 text-sm font-semibold text-white">{s.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{s.detail}</p>
            </div>
            <span aria-hidden className="self-center px-1 py-0.5 text-zinc-600 md:px-1.5">
              <span className="md:hidden">↓</span>
              <span className="hidden md:inline">→</span>
            </span>
          </li>
        ))}
        <li className="flex-1 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.08] p-3 md:min-w-[240px] md:flex-[1.3]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">result</div>
          <div className="mt-1 text-sm font-semibold text-white">{f.result.title}</div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-300">{f.result.detail}</p>
        </li>
      </ol>
    </figure>
  );
}
