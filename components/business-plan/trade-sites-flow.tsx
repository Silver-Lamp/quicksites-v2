// components/business-plan/trade-sites-flow.tsx
//
// The auto-built trade-site loop as a diagram, for the public business plan. Pure SVG, server-
// rendered, no library: it has to survive being forwarded as a link, print cleanly, and read on
// the plan's dark ground without a client bundle.
//
// The shape encodes something true: teal nodes run without a person, amber ones need one, and
// the three counts under the nodes are read from the database at render — the same evidence
// loader the rest of the page uses — so the diagram cannot say "built 40" when the table says 12.
// It states no price; the plan's prose does that, in the vertical that owns it.
import type { PlanEvidence } from '@/lib/business/planEvidence';

type Node = {
  title: string;
  who: 'person' | 'auto' | 'business';
  when: string;
  count?: { value: number; label: string };
};

export function tradeSitesFlowNodes(e: Pick<PlanEvidence, 'tradeDrafts' | 'tradeClaimed' | 'tradePaid'>): Node[] {
  return [
    { title: 'Queue a city', who: 'person', when: 'an operator decides' },
    { title: 'Sweep listings', who: 'auto', when: 'nightly, 06:00' },
    { title: 'Build drafts', who: 'auto', when: 'same run, capped', count: { value: e.tradeDrafts, label: 'drafts built' } },
    { title: 'Mail claim card', who: 'auto', when: 'next night, after review' },
    { title: 'Claim it, free', who: 'business', when: 'the business, by QR', count: { value: e.tradeClaimed, label: 'claimed' } },
    { title: 'Site goes live', who: 'auto', when: 'when it is claimed' },
    { title: 'Buy a domain', who: 'business', when: 'self-serve, card on file', count: { value: e.tradePaid, label: 'paid' } },
  ];
}

const TONE = {
  auto: { stroke: '#2dd4bf', fill: 'rgba(45,212,191,0.10)', text: '#99f6e4', label: 'runs on its own' },
  person: { stroke: '#fbbf24', fill: 'rgba(251,191,36,0.10)', text: '#fde68a', label: 'an operator decides' },
  business: { stroke: '#a3a3a3', fill: 'rgba(163,163,163,0.08)', text: '#e5e5e5', label: 'the business acts' },
} as const;

export default function TradeSitesFlow({ evidence }: { evidence: Pick<PlanEvidence, 'tradeDrafts' | 'tradeClaimed' | 'tradePaid'> }) {
  const nodes = tradeSitesFlowNodes(evidence);
  const W = 1040;
  const H = 236;
  const boxW = 130;
  const boxH = 64;
  const gap = (W - 40 - nodes.length * boxW) / (nodes.length - 1);
  const y = 58;

  return (
    <figure className="mt-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">The loop, as it runs</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-400">
          {(['auto', 'person', 'business'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TONE[k].stroke }} />
              {TONE[k].label}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950/50">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="The trade-site loop: queue a city, sweep, build drafts, mail a claim card, the business claims it, the site goes live, the business buys a domain."
          style={{ minWidth: 860, width: '100%', display: 'block', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          <defs>
            <marker id="tsf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#525252" />
            </marker>
          </defs>
          {nodes.map((n, i) => {
            const x = 20 + i * (boxW + gap);
            const t = TONE[n.who];
            const next = i < nodes.length - 1;
            return (
              <g key={n.title}>
                <rect x={x} y={y} width={boxW} height={boxH} rx={10} fill={t.fill} stroke={t.stroke} strokeWidth={1.5} />
                <text x={x + boxW / 2} y={y + 28} textAnchor="middle" fontSize={13} fontWeight={600} fill={t.text}>
                  {n.title}
                </text>
                <text x={x + boxW / 2} y={y + 47} textAnchor="middle" fontSize={10.5} fill="#a3a3a3">
                  {n.when}
                </text>
                {next && (
                  <line x1={x + boxW + 3} y1={y + boxH / 2} x2={x + boxW + gap - 3} y2={y + boxH / 2} stroke="#525252" strokeWidth={1.5} markerEnd="url(#tsf-arrow)" />
                )}
                {n.count && (
                  <g>
                    <line x1={x + boxW / 2} y1={y + boxH} x2={x + boxW / 2} y2={y + boxH + 22} stroke="#404040" strokeWidth={1} strokeDasharray="3 3" />
                    <text x={x + boxW / 2} y={y + boxH + 56} textAnchor="middle" fontSize={30} fontWeight={700} fill="#fafafa" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {n.count.value.toLocaleString()}
                    </text>
                    <text x={x + boxW / 2} y={y + boxH + 74} textAnchor="middle" fontSize={11} fill="#a3a3a3">
                      {n.count.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {/* The loop closes: a paid domain is the same site, so the arrow returns to "live". */}
          <path
            d={`M ${20 + 6 * (boxW + gap) + boxW / 2} ${y - 6} C ${20 + 6 * (boxW + gap) + boxW / 2} ${y - 34}, ${20 + 5 * (boxW + gap) + boxW / 2} ${y - 34}, ${20 + 5 * (boxW + gap) + boxW / 2} ${y - 6}`}
            fill="none"
            stroke="#525252"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd="url(#tsf-arrow)"
          />
          <text x={20 + 5.5 * (boxW + gap) + boxW / 2} y={y - 40} textAnchor="middle" fontSize={10.5} fill="#a3a3a3">
            same site, their own .com
          </text>
          <text x={20} y={H - 14} fontSize={11} fill="#737373">
            Counts are read from the database at render. Every switch on the automated steps is a spend decision an operator makes once.
          </text>
        </svg>
      </div>
    </figure>
  );
}
