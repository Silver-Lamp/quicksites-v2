'use client';

// components/admin/growth-coach.tsx
//
// The expandable "Growth Coach" pinned at the top of the prospects funnel. Collapsed, it
// shows the single next best action; expanded, the whole funnel as a step checklist where
// each step can be run with one click (every action maps to a real endpoint via onAction).
// Pure presentational — the brain is lib/prospects/growthCoach.ts.

import { useEffect, useState } from 'react';
import type { CoachState, CoachAction, CoachStep } from '@/lib/prospects/growthCoach';

const EXPANDED_KEY = 'qs:growth-coach:expanded';

/** Stable id for an action, for busy-state matching. */
export const actionId = (a: CoachAction | null | undefined) => (a ? `${a.kind}:${a.campaignId ?? ''}` : '');

const STATUS_DOT: Record<CoachStep['status'], string> = {
  done: 'bg-emerald-400',
  active: 'bg-fuchsia-400',
  blocked: 'bg-red-400/70',
  todo: 'bg-neutral-600',
};

export default function GrowthCoach({
  state,
  onAction,
  busyAction,
}: {
  state: CoachState;
  onAction: (a: CoachAction) => void;
  /** actionId currently running, so its button shows a spinner + disables. */
  busyAction: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(EXPANDED_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = () => {
    setExpanded((v) => {
      const n = !v;
      try { localStorage.setItem(EXPANDED_KEY, n ? '1' : '0'); } catch { /* ignore */ }
      return n;
    });
  };

  const primary = state.primary;
  const primaryBusy = !!primary && busyAction === actionId(primary);

  return (
    <div className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/[0.08] to-neutral-900/40 p-4">
      {/* Collapsed header — always visible: the one next action. */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggle} className="flex items-center gap-2 text-left" title={expanded ? 'Collapse' : 'Expand the funnel checklist'}>
          <span className="text-base">✨</span>
          <span className="text-sm font-semibold text-fuchsia-100">Growth Coach</span>
          <span className={`text-[10px] text-fuchsia-300/70 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
        <div className="min-w-0 flex-1 truncate text-sm text-neutral-300">
          <span className="text-neutral-500">Next: </span>{state.headline}
        </div>
        {primary && (
          <button
            onClick={() => onAction(primary)}
            disabled={primaryBusy}
            className="shrink-0 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
          >
            {primaryBusy ? 'Working…' : primary.label}
          </button>
        )}
      </div>

      {/* Expanded — the funnel as a step checklist. */}
      {expanded && (
        <ol className="mt-4 space-y-2 border-t border-fuchsia-500/15 pt-3">
          {state.steps.map((s) => {
            const id = actionId(s.action);
            const busy = !!s.action && busyAction === id;
            return (
              <li key={s.key} className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[s.status]}`} title={s.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium ${s.status === 'done' ? 'text-neutral-500' : 'text-neutral-100'}`}>{s.title}</span>
                    {s.status === 'done' && <span className="text-[11px] text-emerald-400">✓</span>}
                    {s.status === 'blocked' && <span className="text-[11px] text-red-400">blocked</span>}
                  </div>
                  <div className="text-xs text-neutral-400">{s.detail}</div>
                  <div className="text-[11px] text-neutral-600">{s.learn}</div>
                </div>
                {s.action && (
                  <button
                    onClick={() => onAction(s.action!)}
                    disabled={busy}
                    className="shrink-0 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
                  >
                    {busy ? '…' : s.action.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
