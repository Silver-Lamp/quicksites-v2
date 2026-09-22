'use client';

// components/admin/templates/render-blocks/treehouse-planner.tsx
//
// The treehouse planner: answer six questions, get a cost RANGE built from figures three named
// builders publish, plus the questions a builder will ask you. The brain is
// lib/treehouseBuilders/estimate.ts; this file is the form and the result rendering.
//
// ⚠️ THE RESULT MUST NEVER READ AS A QUOTE, and the tempting design is exactly the break: a big
// confident number with the caveats below the fold. So the range, whose figures it came from,
// what the answers moved, and "this is not a quote" all render TOGETHER in the same card. A
// caveat in a tooltip is a caveat nobody reads. (Same rule as bill-estimator.tsx.)
//
// ⚠️ AND THE QUESTIONS RENDER WHETHER OR NOT ANYONE LOOKS AT THE NUMBER. They are the part of
// this page that is actually true for every reader — a web page cannot price someone's trees, but
// it can send them to the first call knowing what they will be asked.
//
// ⚠️ Nothing here outputs a structural design, an attachment method or a safety statement. These
// are structures children climb into.

import * as React from 'react';
import SectionShell from '@/components/ui/section-shell';
import {
  estimate,
  formatRange,
  anchorsUsed,
  type Access,
  type Materials,
  type Scale,
} from '@/lib/treehouseBuilders/estimate';
import { ADD_ON_ANCHORS, ADD_ON_SOURCE } from '@/lib/treehouseBuilders/costData';

type Props = {
  block?: { content?: Record<string, unknown>; props?: Record<string, unknown> };
  content?: Record<string, unknown>;
  colorMode?: 'light' | 'dark';
  previewOnly?: boolean;
};

function pickContent(block: Props['block'], override?: Props['content']) {
  const src = (override ?? block?.content ?? block?.props ?? {}) as Record<string, unknown>;
  return {
    title: String(src.title ?? 'What will a treehouse cost?'),
    blurb: String(src.blurb ?? ''),
  };
}

const SCALES: Array<{ value: Scale; label: string }> = [
  { value: 'platform', label: 'A platform or deck in the trees' },
  { value: 'kids', label: 'A kids’ treehouse' },
  { value: 'family', label: 'A large family treehouse' },
  { value: 'habitable', label: 'Somewhere you could sleep' },
];

const field =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground';

export default function RenderTreehousePlanner({ block, content, previewOnly }: Props) {
  const d = React.useMemo(() => pickContent(block, content), [block, content]);

  const [scale, setScale] = React.useState<Scale>('kids');
  const [enclosed, setEnclosed] = React.useState(false);
  const [access, setAccess] = React.useState<Access>('easy');
  const [materials, setMaterials] = React.useState<Materials>('standard');
  const [engineered, setEngineered] = React.useState(false);
  const [addOns, setAddOns] = React.useState<string[]>([]);

  const result = React.useMemo(
    () => estimate({ scale, enclosed, access, materials, engineered, addOns }),
    [scale, enclosed, access, materials, engineered, addOns],
  );

  const toggle = (key: string) =>
    setAddOns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <SectionShell>
      {/* The anchor lives on a child — SectionShell takes no id, and a hero CTA links to #planner. */}
      <span id="planner" aria-hidden className="block scroll-mt-24" />
      <h2 className="text-2xl font-semibold text-foreground">{d.title}</h2>
      {d.blurb ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{d.blurb}</p> : null}
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Nobody can price a treehouse from a web page. What this does is show you where your project
        sits against the ranges real builders publish, and what they will ask you on the first call.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ---------------- the questions ---------------- */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">What are you picturing?</span>
            <select className={`mt-1 ${field}`} value={scale} onChange={(e) => setScale(e.target.value as Scale)}>
              {SCALES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Getting to the trees</span>
            <select className={`mt-1 ${field}`} value={access} onChange={(e) => setAccess(e.target.value as Access)}>
              <option value="easy">A vehicle can get close</option>
              <option value="tight">Everything arrives by hand</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Decking and finish</span>
            <select className={`mt-1 ${field}`} value={materials} onChange={(e) => setMaterials(e.target.value as Materials)}>
              <option value="standard">Standard pressure-treated timber</option>
              <option value="premium">Composite or hardwood</option>
            </select>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={enclosed} onChange={(e) => setEnclosed(e.target.checked)} />
            <span>Walls, a roof and windows &mdash; not an open platform</span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={engineered} onChange={(e) => setEngineered(e.target.checked)} />
            <span>I&apos;ll need permitted, engineer-stamped drawings</span>
          </label>

          <fieldset>
            <legend className="text-xs uppercase tracking-wide text-muted-foreground">Extras</legend>
            <div className="mt-2 flex flex-col gap-2">
              {ADD_ON_ANCHORS.map((a) => (
                <label key={a.key} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={addOns.includes(a.key)} onChange={() => toggle(a.key)} />
                  <span>{a.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* ---------------- the answer, with its caveats attached ---------------- */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{result.scaleLabel}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
              {formatRange(result.lowUsd, result.highUsd)}
            </div>
            {result.addOnHighUsd > 0 ? (
              <div className="mt-1 text-sm text-muted-foreground">
                plus {formatRange(result.addOnLowUsd, result.addOnHighUsd)} of extras, priced by{' '}
                <a className="underline" href={ADD_ON_SOURCE.url} target="_blank" rel="noopener noreferrer">
                  {ADD_ON_SOURCE.builder}
                </a>
              </div>
            ) : null}

            {/* Not a footnote. The basis sits with the number or the number is a claim. */}
            <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Where those figures come from:</strong> {result.basis}
            </p>
            {result.adjustments.length ? (
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {result.adjustments.map((a) => <li key={a}>{a}</li>)}
              </ul>
            ) : null}
            <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">This is not a quote.</strong> {result.noQuoteReason}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
            <h3 className="text-sm font-semibold text-foreground">What a builder will ask you</h3>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed text-muted-foreground">
              {result.questions.map((q) => <li key={q}>{q}</li>)}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground">What moves the price</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The nine things builders themselves list, whatever you answered above.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {result.factors.map((f) => (
            <li key={f} className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">{f}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Published figures used on this page:</strong>{' '}
          {anchorsUsed().map((a, i) => (
            <React.Fragment key={`${a.builder}-${i}`}>
              {i > 0 ? ' · ' : ''}
              <a className="underline" href={a.url} target="_blank" rel="noopener noreferrer">{a.builder}</a>
              {` (read ${a.read})`}
            </React.Fragment>
          ))}
        </p>
      </div>

      {previewOnly ? (
        <p className="mt-3 text-xs text-muted-foreground">Editor preview — the planner is interactive on the published site.</p>
      ) : null}
    </SectionShell>
  );
}
