// components/admin/analytics-flow.tsx
//
// The analytics stack as a diagram, drawn entirely from lib/analytics/stack.ts. Pure SVG,
// server-rendered, no library — same reasoning as components/business-plan/trade-sites-flow.tsx:
// it must print, survive being forwarded, and need no client bundle.
//
// The shape encodes the two facts that matter and are easy to forget:
//   • the browser lane passes through ONE gate (isSyntheticVisitor) before any collector, and
//   • the server lane does not, because there is no browser to lie about.
// Live status comes from the caller, which read it from the running process.

import type { SystemStatus } from '@/lib/analytics/stack';
import { AUTOMATION_LABEL } from '@/lib/analytics/stack';

const TONE = {
  server: { stroke: '#2dd4bf', fill: 'rgba(45,212,191,0.10)', text: '#99f6e4' },
  client: { stroke: '#60a5fa', fill: 'rgba(96,165,250,0.10)', text: '#bfdbfe' },
  gate: { stroke: '#fbbf24', fill: 'rgba(251,191,36,0.10)', text: '#fde68a' },
  muted: { stroke: '#525252', fill: 'rgba(82,82,82,0.10)', text: '#d4d4d4' },
} as const;

export default function AnalyticsFlow({ statuses }: { statuses: SystemStatus[] }) {
  const client = statuses.filter((s) => s.system.side === 'client');
  const server = statuses.filter((s) => s.system.side === 'server');

  const W = 1060;
  const boxW = 236;
  const boxH = 74;
  const rowGap = 16;
  const clientTop = 84;
  const serverTop = clientTop + client.length * (boxH + rowGap) + 34;
  const H = serverTop + server.length * (boxH + rowGap) + 52;

  const xSource = 16;
  const xGate = 286;
  const xCollector = 520;
  const xDest = 812;
  const sourceW = 236;
  const gateW = 200;
  const destW = 232;

  const clientMid = clientTop + (client.length * (boxH + rowGap) - rowGap) / 2;
  const serverMid = serverTop + (server.length * (boxH + rowGap) - rowGap) / 2;

  return (
    <figure className="mt-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Where an event comes from, and where it lands
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {[
            ['client', 'browser'],
            ['server', 'server (authoritative)'],
            ['gate', 'automation gate'],
          ].map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: TONE[k as keyof typeof TONE].stroke }}
              />
              {label}
            </span>
          ))}
        </span>
      </figcaption>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/20">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Analytics flow: a browser visit passes the automation gate before reaching the browser collectors; a database transition goes straight to the server collector; both land in the vendor dashboards."
          style={{ minWidth: 900, width: '100%', display: 'block', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          <defs>
            <marker id="af-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#737373" />
            </marker>
            <marker id="af-arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#404040" />
            </marker>
          </defs>

          {/* column headings */}
          {[
            [xSource, sourceW, 'What happened'],
            [xGate, gateW, 'Gate'],
            [xCollector, boxW, 'Collector (this repo)'],
            [xDest, destW, 'Lands in'],
          ].map(([x, w, label]) => (
            <text key={String(label)} x={(x as number) + (w as number) / 2} y={30} textAnchor="middle" fontSize={11} fontWeight={600} fill="#a3a3a3" letterSpacing={0.6}>
              {String(label).toUpperCase()}
            </text>
          ))}

          {/* ---------- browser lane ---------- */}
          <rect x={xSource} y={clientMid - boxH / 2} width={sourceW} height={boxH} rx={10} fill={TONE.client.fill} stroke={TONE.client.stroke} strokeWidth={1.5} />
          <text x={xSource + sourceW / 2} y={clientMid - 6} textAnchor="middle" fontSize={13} fontWeight={600} fill={TONE.client.text}>
            A person loads a page
          </text>
          <text x={xSource + sourceW / 2} y={clientMid + 14} textAnchor="middle" fontSize={10.5} fill="#a3a3a3">
            any public or admin surface
          </text>

          <line x1={xSource + sourceW + 4} y1={clientMid} x2={xGate - 6} y2={clientMid} stroke="#737373" strokeWidth={1.5} markerEnd="url(#af-arrow)" />

          {/* the gate */}
          <rect x={xGate} y={clientMid - boxH / 2} width={gateW} height={boxH} rx={10} fill={TONE.gate.fill} stroke={TONE.gate.stroke} strokeWidth={1.5} />
          <text x={xGate + gateW / 2} y={clientMid - 10} textAnchor="middle" fontSize={12.5} fontWeight={600} fill={TONE.gate.text}>
            isSyntheticVisitor()
          </text>
          <text x={xGate + gateW / 2} y={clientMid + 8} textAnchor="middle" fontSize={10} fill="#a3a3a3">
            navigator.webdriver, then UA
          </text>
          <text x={xGate + gateW / 2} y={clientMid + 23} textAnchor="middle" fontSize={10} fill="#fbbf24">
            automation stops here
          </text>

          {/* gate → each client collector */}
          {client.map((s, i) => {
            const y = clientTop + i * (boxH + rowGap) + boxH / 2;
            return (
              <path
                key={`edge-${s.system.id}`}
                d={`M ${xGate + gateW + 4} ${clientMid} C ${xGate + gateW + 40} ${clientMid}, ${xCollector - 40} ${y}, ${xCollector - 6} ${y}`}
                fill="none"
                stroke="#737373"
                strokeWidth={1.5}
                markerEnd="url(#af-arrow)"
              />
            );
          })}

          {/* ---------- server lane ---------- */}
          <rect x={xSource} y={serverMid - boxH / 2} width={sourceW} height={boxH} rx={10} fill={TONE.server.fill} stroke={TONE.server.stroke} strokeWidth={1.5} />
          <text x={xSource + sourceW / 2} y={serverMid - 6} textAnchor="middle" fontSize={13} fontWeight={600} fill={TONE.server.text}>
            The database changes
          </text>
          <text x={xSource + sourceW / 2} y={serverMid + 14} textAnchor="middle" fontSize={10.5} fill="#a3a3a3">
            order paid, fee collected, claim
          </text>

          {server.map((s, i) => {
            const y = serverTop + i * (boxH + rowGap) + boxH / 2;
            return (
              <path
                key={`sedge-${s.system.id}`}
                d={`M ${xSource + sourceW + 4} ${serverMid} C ${xSource + sourceW + 90} ${serverMid}, ${xCollector - 90} ${y}, ${xCollector - 6} ${y}`}
                fill="none"
                stroke="#737373"
                strokeWidth={1.5}
                markerEnd="url(#af-arrow)"
              />
            );
          })}
          <text x={(xSource + sourceW + xCollector) / 2} y={serverMid - 12} textAnchor="middle" fontSize={10} fill="#737373">
            no gate — there is no browser to check
          </text>

          {/* ---------- collectors + destinations ---------- */}
          {[...client, ...server].map((s, idx) => {
            const isClient = s.system.side === 'client';
            const i = isClient ? client.indexOf(s) : server.indexOf(s);
            const y = (isClient ? clientTop : serverTop) + i * (boxH + rowGap);
            const t = s.status === 'configured' ? TONE[s.system.side] : TONE.muted;
            const mid = y + boxH / 2;
            return (
              <g key={s.system.id}>
                <rect x={xCollector} y={y} width={boxW} height={boxH} rx={10} fill={t.fill} stroke={t.stroke} strokeWidth={1.5} strokeDasharray={s.status === 'configured' ? undefined : '5 4'} />
                <text x={xCollector + 14} y={y + 24} fontSize={12.5} fontWeight={600} fill={t.text}>
                  {s.system.label}
                </text>
                <text x={xCollector + 14} y={y + 42} fontSize={10} fill="#a3a3a3">
                  {AUTOMATION_LABEL[s.system.automation]}
                </text>
                <text x={xCollector + 14} y={y + 60} fontSize={10} fill={s.status === 'configured' ? '#4ade80' : '#a3a3a3'}>
                  {s.status === 'configured' ? '● sending' : '○ not configured'}
                </text>

                <line x1={xCollector + boxW + 4} y1={mid} x2={xDest - 6} y2={mid} stroke="#404040" strokeWidth={1.25} markerEnd="url(#af-arrow-dim)" />
                <rect x={xDest} y={y + 10} width={destW} height={boxH - 20} rx={8} fill="rgba(82,82,82,0.10)" stroke="#525252" strokeWidth={1.25} />
                <text x={xDest + destW / 2} y={y + boxH / 2 + 4} textAnchor="middle" fontSize={11.5} fill="#d4d4d4">
                  {s.system.vendor}
                </text>
              </g>
            );
          })}

          <text x={xSource} y={H - 14} fontSize={11} fill="#737373">
            Drawn from lib/analytics/stack.ts. Status is read from this running deploy; a test fails if a call site is added without declaring it here.
          </text>
        </svg>
      </div>
    </figure>
  );
}
