'use client';

import { useEffect, useState } from 'react';

type Row = { id:number; state:string; county:string; active:boolean };

export default function MehkoCountiesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState('CA');
  const [county, setCounty] = useState('');
  const [busy, setBusy] = useState<number | 'create' | null>(null);

  async function load() {
    const r = await fetch('/api/admin/mehko/counties');
    const d = await r.json(); setRows(d.counties || []);
  }
  useEffect(() => { load(); }, []);

  async function createRow() {
    setBusy('create');
    const r = await fetch('/api/admin/mehko/counties', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ state, county })
    });
    setBusy(null);
    if (r.ok) { setCounty(''); load(); } else alert('Create failed');
  }

  async function setActive(id:number, active:boolean) {
    setBusy(id);
    await fetch(`/api/admin/mehko/counties/${id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ active })
    });
    setBusy(null); load();
  }

  async function remove(id:number) {
    if (!confirm('Remove this county?')) return;
    setBusy(id);
    await fetch(`/api/admin/mehko/counties/${id}`, { method:'DELETE' });
    setBusy(null); load();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">MEHKO Opt-in Counties</h3>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs">State</label>
          <input value={state} onChange={e=>setState(e.target.value.toUpperCase())} className="border rounded px-2 py-1 text-sm w-24" />
        </div>
        <div>
          <label className="text-xs">County</label>
          <input value={county} onChange={e=>setCounty(e.target.value)} className="border rounded px-2 py-1 text-sm w-56" />
        </div>
        <button disabled={busy==='create' || !county} onClick={createRow} className="border rounded px-3 py-1 text-sm">
          {busy==='create' ? 'Adding…' : 'Add'}
        </button>
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr><th className="py-2 px-3">State</th><th className="py-2 px-3">County</th><th className="py-2 px-3">Active</th><th className="py-2 px-3"></th></tr>
          </thead>
          <tbody>
            {(rows||[]).map(r => (
              <tr key={r.id} className="border-t">
                <td className="py-2 px-3">{r.state}</td>
                <td className="py-2 px-3">{r.county}</td>
                <td className="py-2 px-3">
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={r.active} onChange={e=>setActive(r.id, e.target.checked)} />
                    {r.active ? 'Yes' : 'No'}
                  </label>
                </td>
                <td className="py-2 px-3">
                  <button disabled={busy===r.id} onClick={()=>remove(r.id)} className="border rounded px-2 py-1 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
