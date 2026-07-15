'use client';

// Progress view for the readiness pipeline (run every one-click fix for a site, in order).
// Shows a spinner while the run is in flight, then each step's outcome + the before→after
// readiness score. Fed by /api/admin/templates/run-readiness-pipeline. Types are import-only
// (the source module is server-side) so nothing server-side is bundled here.

import { Loader2, Check, Minus, ChevronsRight, AlertTriangle } from 'lucide-react';
import type { PipelineResult } from '@/lib/seo/runReadinessPipeline';
import type { PipelineStepStatus } from '@/lib/seo/pipelineClassify';

const STATUS_META: Record<PipelineStepStatus, { Icon: typeof Check; cls: string; tag: string }> = {
  ran: { Icon: Check, cls: 'text-emerald-400', tag: 'Fixed' },
  satisfied: { Icon: Check, cls: 'text-emerald-400/70', tag: 'Already done' },
  noop: { Icon: Minus, cls: 'text-neutral-400', tag: 'No change' },
  skipped: { Icon: ChevronsRight, cls: 'text-neutral-500', tag: 'Skipped' },
  error: { Icon: AlertTriangle, cls: 'text-red-400', tag: 'Error' },
};

export default function PipelineProgressModal({
  running,
  result,
  onClose,
}: {
  running: boolean;
  result: PipelineResult | null;
  onClose: () => void;
}) {
  const steps = result?.steps ?? [];
  const fixed = steps.filter((s) => s.status === 'ran').length;

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={() => !running && onClose()}>
      <div className="my-4 w-full max-w-lg rounded-2xl border border-fuchsia-500/30 bg-neutral-900 p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Run readiness steps</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Every one-click fix for this site, in order. Safe to re-run — done steps are skipped.
            </p>
          </div>
          <button onClick={() => !running && onClose()} disabled={running} className="rounded-full p-1 text-neutral-500 hover:text-white disabled:opacity-40" aria-label="Close">✕</button>
        </div>

        {result && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950/40 p-3 text-sm">
            <span className="text-neutral-400">Readiness</span>
            <span className="font-mono text-neutral-300">{result.before.done}/{result.before.total}</span>
            <ChevronsRight className="h-4 w-4 text-neutral-600" />
            <span className="font-mono font-semibold text-emerald-300">{result.after.done}/{result.after.total}</span>
            <span className="ml-auto text-xs text-neutral-500">{fixed > 0 ? `${fixed} fixed` : 'nothing left to auto-fix'}</span>
          </div>
        )}

        <ul className="mt-4 space-y-1.5">
          {running && steps.length === 0 && (
            <li className="flex items-center gap-2 py-6 text-sm text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Running steps…
            </li>
          )}
          {steps.map((s) => {
            const m = STATUS_META[s.status];
            return (
              <li key={s.key} className="flex items-start gap-2.5 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                <m.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${m.cls}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-100">{s.label}</span>
                    <span className={`text-[10px] uppercase tracking-wide ${m.cls}`}>{m.tag}</span>
                  </div>
                  <div className="truncate text-xs text-neutral-400">{s.message}</div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={running} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">
            {running ? 'Running…' : 'Done'}
          </button>
        </div>
        {result && fixed > 0 && (
          <p className="mt-2 text-right text-[11px] text-neutral-500">Reload the editor to see the changes in the preview.</p>
        )}
      </div>
    </div>
  );
}
