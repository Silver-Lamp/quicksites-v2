'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import clsx from 'clsx';

type AuditRow = {
  id: string;
  provider: string;
  model_code: string;
  modality: string;
  old: any | null;
  new: any;
  change_pct: number | null;
  applied: boolean;
  created_at: string;
};

const FIELDS: Array<{ key: keyof any; label: string }> = [
  { key: 'input_per_1k_usd', label: 'Input /1k' },
  { key: 'output_per_1k_usd', label: 'Output /1k' },
  { key: 'image_base_usd', label: 'Image base' },
  { key: 'image_per_mp_usd', label: 'Image /MP' },
  { key: 'stt_per_min_usd', label: 'STT /min' },
  { key: 'tts_per_1k_chars_usd', label: 'TTS /1k chars' },
];

export default function ReviewPricingChangesPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  async function load(status: 'pending'|'applied'|'all' = 'pending') {
    setLoading(true);
    const r = await fetch(`/api/admin/ai-pricing/audit?status=${status}`, { cache: 'no-store' });
    const j = await r.json();
    setRows(j.rows || []);
    setSelected({});
    setLoading(false);
  }

  useEffect(() => { load('pending'); }, []);

  async function act(op: 'apply'|'revert'|'dismiss') {
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (!ids.length) return;
    const r = await fetch('/api/admin/ai-pricing/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, ids }),
    });
    if (r.ok) load('pending');
  }

  function format(n: any) { return (n == null ? '—' : `$${Number(n).toFixed(6)}`); }

  // ------- Select All logic -------
  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const someSelected = selectedCount > 0 && selectedCount < rows.length;
  const masterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = {};
    if (checked) rows.forEach(r => (next[r.id] = true));
    else rows.forEach(r => (next[r.id] = false));
    setSelected(next);
  }
  // --------------------------------

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Pricing Changes — Review</h1>
          <div className="flex items-center gap-2">
            {!!selectedCount && (
              <span className="text-xs rounded bg-muted px-2 py-1">{selectedCount} selected</span>
            )}
            <Button variant="secondary" onClick={()=>load('pending')} disabled={loading}>Pending</Button>
            <Button variant="secondary" onClick={()=>load('applied')} disabled={loading}>History</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Pending Changes</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 flex gap-2">
              <Button size="sm" onClick={()=>act('apply')} disabled={loading}>Apply</Button>
              <Button size="sm" onClick={()=>act('revert')} disabled={loading}>Revert to Old</Button>
              <Button size="sm" variant="secondary" onClick={()=>act('dismiss')} disabled={loading}>Dismiss</Button>
              <Button size="sm" variant="outline" onClick={()=>load('pending')} disabled={loading}>Refresh</Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleAll(!allSelected)}
                disabled={!rows.length}
                title={allSelected ? 'Clear all' : 'Select all'}
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </Button>
            </div>

            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 w-8">
                      <input
                        ref={masterRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleAll(e.target.checked)}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="p-2 text-left">Model</th>
                    <th className="p-2 text-left">Modality</th>
                    <th className="p-2 text-left">Δ%</th>
                    {FIELDS.map(f => <th key={String(f.key)} className="p-2 text-left">{f.label}</th>)}
                    <th className="p-2 text-left">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const diffKeys = new Set<string>();
                    FIELDS.forEach(f => {
                      const a = r.old?.[f.key as any];
                      const b = r.new?.[f.key as any];
                      if ((a ?? null) !== (b ?? null)) diffKeys.add(String(f.key));
                    });
                    return (
                      <tr key={r.id} className="border-t align-top">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={!!selected[r.id]}
                            onChange={e=>setSelected(s=>({ ...s, [r.id]: e.target.checked }))}
                            aria-label={`Select ${r.provider}/${r.model_code} ${r.modality}`}
                          />
                        </td>
                        <td className="p-2 font-medium">{r.provider}/{r.model_code}</td>
                        <td className="p-2">{r.modality}</td>
                        <td className="p-2">{r.change_pct == null ? '—' : `${r.change_pct.toFixed(2)}%`}</td>
                        {FIELDS.map(f => {
                          const changed = diffKeys.has(String(f.key));
                          return (
                            <td key={String(f.key)} className={clsx('p-2', changed && 'bg-yellow-50 dark:bg-yellow-950/30')}>
                              <div className="text-xs text-muted-foreground">{format(r.old?.[f.key as any])}</div>
                              <div>{format(r.new?.[f.key as any])}</div>
                            </td>
                          );
                        })}
                        <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">No pending changes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
