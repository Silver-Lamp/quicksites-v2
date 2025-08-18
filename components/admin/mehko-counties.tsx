// components/admin/mehko-counties.tsx
'use client';

import { useEffect, useState } from 'react';
import { getJSON, postJSON } from './tools/http';

type Row = { id: number; state: string; county: string; active: boolean };

export default function MehkoCountiesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [stateCode, setStateCode] = useState('CA');
  const [county, setCounty] = useState('');
  const [busy, setBusy] = useState<number | 'create' | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await getJSON('/api/admin/mehko/counties'); // should include credentials
      setRows((r.counties || []).sort(sorter));
    } catch (e: any) {
      setErr(e?.message || 'Failed to load counties');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function sorter(a: Row, b: Row) {
    // sort by state, then county
    return a.state.localeCompare(b.state) || a.county.localeCompare(b.county);
    }

  async function createRow() {
    const s = stateCode.trim().toUpperCase();
    const c = county.trim();
    if (s.length !== 2) return alert('State should be a 2-letter code (e.g., CA)');
    if (!c) return;

    setBusy('create');
    setErr(null);
    try {
      const r = await postJSON('/api/admin/mehko/counties', { state: s, county: c });
      if (!r?.ok) throw new Error(r?.error || 'Create failed');
      setCounty('');
      await load(); // ensure id/ordering match server
    } catch (e: any) {
      setErr(e?.message || 'Create failed');
    } finally {
      setBusy(null);
    }
  }

  async function setActive(id: number, active: boolean) {
    setBusy(id);
    setErr(null);

    // optimistic update
    const prev = rows;
    const next = prev.map((r) => (r.id === id ? { ...r, active } : r));
    setRows(next);

    try {
      const r = await postJSON(`/api/admin/mehko/counties/${id}`, { active });
      if (!r?.ok) throw new Error(r?.error || 'Update failed');
    } catch (e: any) {
      setErr(e?.message || 'Update failed');
      setRows(prev); // rollback
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number) {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    if (!confirm(`Remove ${target.county}, ${target.state}?`)) return;

    setBusy(id);
    setErr(null);
    try {
      const r = await postJSON(`/api/admin/mehko/counties/${id}`, { _delete: true });
      if (!r?.ok) throw new Error(r?.error || 'Delete failed');
      setRows((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setErr(e?.message || 'Delete failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">MEHKO Opt-in Counties</h3>
      <p className="text-sm text-muted-foreground">
        Track which counties have opted into MEHKO. Use the form to add more and toggle their status below.
      </p>

      {/* Add row */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="mehko-state">
              State (2-letter)
            </label>
            <input
              id="mehko-state"
              value={stateCode}
              onChange={(e) =>
                setStateCode(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))
              }
              maxLength={2}
              className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="CA"
              autoComplete="off"
            />
          </div>
          <div className="flex-1 min-w-[14rem] space-y-1">
            <label className="text-xs font-medium" htmlFor="mehko-county">
              County
            </label>
            <input
              id="mehko-county"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="San Francisco"
              autoComplete="off"
            />
          </div>
          <button
            disabled={busy === 'create' || !county.trim() || stateCode.trim().length !== 2}
            onClick={createRow}
            className={[
              'rounded-md px-3 py-2 text-sm',
              busy === 'create' || !county.trim() || stateCode.trim().length !== 2
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'bg-blue-600 text-white hover:bg-blue-700',
            ].join(' ')}
          >
            {busy === 'create' ? 'Adding…' : 'Add'}
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading counties…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No counties yet.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr className="text-muted-foreground">
                <th className="py-2 px-3 font-medium">State</th>
                <th className="py-2 px-3 font-medium">County</th>
                <th className="py-2 px-3 font-medium">Active</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="py-2 px-3 font-mono">{r.state}</td>
                  <td className="py-2 px-3">{r.county}</td>
                  <td className="py-2 px-3">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={r.active}
                        disabled={busy === r.id}
                        onChange={(e) => setActive(r.id, e.target.checked)}
                      />
                      {r.active ? 'Yes' : 'No'}
                    </label>
                  </td>
                  <td className="py-2 px-3">
                    <button
                      disabled={busy === r.id}
                      onClick={() => remove(r.id)}
                      className={[
                        'rounded-md px-2 py-1 text-xs',
                        busy === r.id
                          ? 'cursor-not-allowed bg-muted text-muted-foreground'
                          : 'border border-border/60 bg-background hover:bg-muted',
                      ].join(' ')}
                    >
                      {busy === r.id ? 'Working…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
