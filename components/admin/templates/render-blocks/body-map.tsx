'use client';

// The `body_map` block (Tried & Graded, 2026-10-24): a blueprint body drawing whose regions list
// every graded claim about that part of the body, each with the grade DERIVED from the study
// records at render (lib/evidence/bodyMap.ts → gradeClaim). The block stores only an optional
// title, so it cannot carry a grade or a mapping the records do not produce.
//
// The figure is a generated blueprint-style ANATOMICAL drawing (public/guide/body-blueprint.webp,
// OpenArt, 2026-10-24, owner's ask). It is a deliberate, narrow reading of the no-generated-people
// rule (lib/images/noPeople.ts): that rule exists so a page never asserts a person who does not
// exist — staff, diners, a customer. A faceless line diagram of organs and bones depicts no one;
// it is a medical illustration, the same class as a textbook figure. Never swap in a photographic
// or faced figure on the strength of this comment. Region buttons are repeated as a list
// so the map works by keyboard, by screen reader and on a phone, where small targets on a figure
// are hard to hit.
import * as React from 'react';
import { BODY_REGIONS, entriesByRegion, type BodyRegionId } from '@/lib/evidence/bodyMap';
import { GRADE_LABEL } from '@/lib/evidence/grade';
import { GRADE_BADGE } from '@/components/admin/templates/render-blocks/evidence-claims';

type Content = { title?: string };

function pickContent(block: any, override?: any): Content {
  return (override ?? block?.content ?? block?.props ?? {}) as Content;
}

/** The drawing, and hotspot centres in ITS pixels (576×1024). `whole_life` is not on the body.
 *  Each spot sits on the drawn organ or bone it names — re-place them if the image changes. */
export const BODY_DRAWING = { src: '/guide/body-blueprint.webp', w: 576, h: 1024 } as const;
const SPOTS: Partial<Record<BodyRegionId, { x: number; y: number }>> = {
  head: { x: 288, y: 92 }, // the drawn brain
  ears: { x: 334, y: 130 },
  nose: { x: 288, y: 150 },
  throat: { x: 288, y: 205 }, // the trachea
  lungs: { x: 248, y: 272 },
  heart: { x: 308, y: 295 },
  immune: { x: 384, y: 252 }, // the armpit — lymph nodes
  gut: { x: 288, y: 432 }, // the intestines
  skin: { x: 132, y: 452 }, // the forearm
  muscles: { x: 238, y: 610 }, // the thigh
  joints: { x: 338, y: 720 }, // the drawn knee joint
};

const PRIMARY = 'hsl(var(--primary))';
const PRIMARY_FG = 'hsl(var(--primary-foreground))';

export default function BodyMapRender({ block, content }: { block: any; content?: any }) {
  const c = pickContent(block, content);
  const byRegion = React.useMemo(() => entriesByRegion(), []);
  const [active, setActive] = React.useState<BodyRegionId>('lungs');
  const region = BODY_REGIONS.find((r) => r.id === active)!;
  const entries = byRegion[active] ?? [];

  const choose = (id: BodyRegionId) => setActive(id);
  const onKey = (id: BodyRegionId) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(id); }
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 text-foreground" data-body-map="1">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Body map · grades calculated from the studies</p>
      {c.title ? <h2 className="mb-1 text-2xl font-medium tracking-tight">{c.title}</h2> : null}
      <p className="mb-6 text-sm text-muted-foreground">
        Tap a part of the body to see every claim we have graded about it. A place on the body shows what a claim is <em>about</em> — the grade says whether the evidence supports it.
      </p>

      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        <div>
          <svg
            viewBox={`0 0 ${BODY_DRAWING.w} ${BODY_DRAWING.h}`}
            className="mx-auto w-full max-w-[300px] overflow-hidden rounded-xl bg-[#0b4f9c] shadow-sm"
            role="group"
            aria-label="Body map"
          >
            {/* The blueprint underlay; the hotspots below are drawn in the same coordinate space. */}
            <image href={BODY_DRAWING.src} width={BODY_DRAWING.w} height={BODY_DRAWING.h} aria-hidden="true" />
            {BODY_REGIONS.filter((r) => SPOTS[r.id]).map((r) => {
              const p = SPOTS[r.id]!;
              const n = byRegion[r.id]?.length ?? 0;
              const on = r.id === active;
              return (
                <g
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${r.label}: ${n} ${n === 1 ? 'claim' : 'claims'}`}
                  aria-pressed={on}
                  onClick={() => choose(r.id)}
                  onKeyDown={onKey(r.id)}
                  className="cursor-pointer focus:outline-none"
                  data-region={r.id}
                >
                  {/* White ring + dot: the site's accent is not guaranteed to read on blueprint blue. */}
                  {on ? <circle cx={p.x} cy={p.y} r={32} fill="none" stroke="#ffffff" strokeWidth={4} /> : null}
                  <circle cx={p.x} cy={p.y} r={22} fill={PRIMARY} fillOpacity={on ? 1 : 0.85} stroke="#ffffff" strokeWidth={2.5} />
                  <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize={20} fontWeight={700} fill={PRIMARY_FG}>{n}</text>
                </g>
              );
            })}
          </svg>

          <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Parts of the body">
            {BODY_REGIONS.map((r) => {
              const n = byRegion[r.id]?.length ?? 0;
              const on = r.id === active;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => choose(r.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${on ? 'border-foreground/60 bg-foreground/10' : 'border-border text-muted-foreground hover:bg-foreground/5'}`}
                >
                  {r.label} <span className="opacity-60">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div aria-live="polite">
          <h3 className="text-xl font-medium tracking-tight">{region.label}</h3>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">{region.blurb}</p>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing graded here yet.</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {entries.map((e, i) => (
                <li key={`${e.topicLabel}-${i}`} className="flex flex-wrap items-start justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium leading-snug">{e.claim}</div>
                    <a href={e.href} className="mt-1 inline-block text-sm text-muted-foreground underline underline-offset-2">
                      {e.topicLabel} — see the evidence
                    </a>
                  </div>
                  {e.kind === 'graded' ? (
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground ${GRADE_BADGE[e.grade]}`} data-grade={e.grade}>
                      {GRADE_LABEL[e.grade]}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground" data-grade="untested">
                      Not yet tested
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
