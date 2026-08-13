'use client';

// components/admin/draft-signals-cell.tsx
//
// "What's notable about this draft" — the observations an operator would otherwise find by reading
// a JSON blob, shown in the row they are about to act on.
//
// ⚠️ IT SHOWS FACTS, NOT DRAFT COPY, and that is deliberate — see the header of
// lib/outreach/draftSignals.ts. The moment this cell renders a sentence someone can paste, every
// outreach message converges on the handful of things a machine can detect, and the thing that
// makes these messages work (a person actually looked at the page) becomes a format.
//
// ⚠️ WHY IT EARNS ITS PLACE ANYWAY: a red signal is usually OUR bug on a page a real business may be
// about to open — 28 dishes priced "$", both sizes crushed into one field, every item at $14. Those
// were all found by hand, after the drafts were already live. One of them was found only after a
// message about it had been sent.
import { useState } from 'react';
import type { Signal } from '@/lib/outreach/draftSignals';

export default function DraftSignalsCell({ signals }: { signals?: Signal[] }) {
  const [open, setOpen] = useState(false);
  const list = signals ?? [];
  if (!list.length) return <span className="text-xs text-neutral-600">—</span>;

  const defects = list.filter((s) => s.severity === 'defect').length;
  const notes = list.length - defects;

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        // Alpha tints, never 50/100-weight fills — the admin chrome is always dark (CLAUDE.md §7).
        className={
          defects
            ? 'rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-medium text-red-200 hover:bg-red-500/20'
            : 'rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-medium text-sky-200 hover:bg-sky-500/20'
        }
        title={defects ? 'Likely wrong on the page itself' : 'Worth a mention'}
      >
        {defects > 0 && `${defects} to fix`}
        {defects > 0 && notes > 0 && ' · '}
        {notes > 0 && `${notes} notable`}
      </button>

      {open && (
        <ul className="mt-2 space-y-2 text-left">
          {list.map((s, i) => (
            <li key={`${s.kind}-${i}`} className="max-w-xs">
              <span className={s.severity === 'defect' ? 'text-red-300' : 'text-sky-300'}>
                {s.severity === 'defect' ? '🔴' : '🔵'} {s.label}
              </span>
              <p className="mt-0.5 text-neutral-400">{s.detail}</p>
            </li>
          ))}
          <li className="max-w-xs border-t border-white/10 pt-2 text-neutral-500">
            Observations, not copy — open the page before writing anything about it.
          </li>
        </ul>
      )}
    </div>
  );
}
