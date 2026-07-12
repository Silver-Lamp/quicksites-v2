'use client';

// components/admin/templates/readiness-coach.tsx
//
// In-editor "Readiness coach" for geo pitch sites. Shows a live SEO-readiness checklist that
// updates as the operator edits (reads the editor's current data from context), so they can
// see what's left before the site is mail-ready — and sign it off with "Mark ready" once the
// required checks pass. The checklist logic is pure (lib/outreach/readiness.ts#readinessChecklist).

import { useEffect, useMemo, useState } from 'react';
import { useTemplateEditor } from '@/context/template-editor-context';
import { readinessChecklist, type ChecklistItem } from '@/lib/outreach/readiness';

const EXPANDED_KEY = 'qs:readiness-coach:expanded';

export default function ReadinessCoach({
  campaignId,
  industryKey,
  initialReadyAt,
}: {
  campaignId: string;
  industryKey: string;
  initialReadyAt: string | null;
}) {
  const ctx = useTemplateEditor();
  const data = (ctx as any)?.template?.data ?? {};

  const items = useMemo(() => readinessChecklist(data, industryKey), [data, industryKey]);
  const hard = items.filter((i) => i.severity === 'hard');
  const hardLeft = hard.filter((i) => !i.ok).length;
  const doneCount = items.filter((i) => i.ok).length;

  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem(EXPANDED_KEY);
      if (v != null) setExpanded(v === '1');
    } catch { /* ignore */ }
  }, []);
  const toggle = () =>
    setExpanded((v) => {
      const n = !v;
      try { localStorage.setItem(EXPANDED_KEY, n ? '1' : '0'); } catch { /* ignore */ }
      return n;
    });

  const [readyAt, setReadyAt] = useState<string | null>(initialReadyAt);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function markReady(ready: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/prospects/geo-campaign/mark-refined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, ready }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const blockers = Array.isArray(json.blockers) ? json.blockers.filter((b: any) => b.severity === 'hard').map((b: any) => b.label) : [];
        setMsg({ ok: false, text: blockers.length ? `Clear first: ${blockers.join(' · ')}` : (json.error || 'Could not update.') });
        return;
      }
      setReadyAt(ready ? new Date().toISOString() : null);
      setMsg({ ok: true, text: ready ? 'Marked ready for outreach ✓' : 'Marked not ready' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const Row = ({ i }: { i: ChecklistItem }) => (
    <li className="flex items-start gap-2 py-0.5">
      <span className={`mt-0.5 shrink-0 text-sm ${i.ok ? 'text-emerald-400' : i.severity === 'hard' ? 'text-amber-400' : 'text-neutral-500'}`}>{i.ok ? '☑' : '☐'}</span>
      <span className="min-w-0">
        <span className={`text-sm ${i.ok ? 'text-neutral-400 line-through' : 'text-neutral-100'}`}>{i.label}</span>
        {i.severity === 'hard' && !i.ok && <span className="ml-1 text-[10px] uppercase text-amber-400/80">required</span>}
        {i.hint && !i.ok && <span className="block text-[11px] text-neutral-500">{i.hint}</span>}
      </span>
    </li>
  );

  return (
    <div className="border-b border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggle} className="flex items-center gap-2" title={expanded ? 'Collapse' : 'Expand the SEO readiness checklist'}>
          <span className="text-sm">📋</span>
          <span className="text-sm font-semibold text-fuchsia-100">SEO readiness</span>
          <span className={`text-[10px] text-fuchsia-300/70 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${items.length ? Math.round((doneCount / items.length) * 100) : 0}%` }} />
          </div>
          <span className="text-xs text-neutral-400">
            {doneCount}/{items.length} done{hardLeft > 0 ? ` · ${hardLeft} required left` : readyAt ? '' : ' · ready to sign off'}
          </span>
        </div>
        {readyAt ? (
          <button onClick={() => markReady(false)} disabled={busy} className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">
            {busy ? '…' : 'Ready ✓'}
          </button>
        ) : (
          <button
            onClick={() => markReady(true)}
            disabled={busy || hardLeft > 0}
            title={hardLeft > 0 ? `Clear ${hardLeft} required check(s) first` : 'Mark this site ready for outreach'}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${hardLeft > 0 ? 'cursor-not-allowed bg-neutral-800 text-neutral-500' : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500'} disabled:opacity-60`}
          >
            {busy ? 'Working…' : 'Mark ready'}
          </button>
        )}
      </div>

      {msg && <div className={`mt-1 text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</div>}

      {expanded && (
        <div className="mt-2 grid gap-x-8 gap-y-1 border-t border-fuchsia-500/15 pt-2 sm:grid-cols-2">
          <ul>
            <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Required</div>
            {hard.map((i) => <Row key={i.id} i={i} />)}
          </ul>
          <ul>
            <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Recommended</div>
            {items.filter((i) => i.severity === 'soft').map((i) => <Row key={i.id} i={i} />)}
          </ul>
        </div>
      )}
    </div>
  );
}
