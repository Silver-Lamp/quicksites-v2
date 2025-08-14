'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Row = {
  id:string; merchant_id:string; requirement_id:string;
  kind:string|null; file_url:string|null; issued_at?:string|null; expires_at?:string|null;
  merchants?: { display_name?:string|null; name?:string|null };
  compliance_requirements?: { code:string; operation_type:string; juris_state:string };
  fields?: any;
};

export default function ComplianceQueue() {
  const [status, setStatus] = useState<'pending'|'approved'|'rejected'|'expired'>('pending');
  const [state, setState] = useState('');
  const [op, setOp] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string|null>(null);

  async function load() {
    const qs = new URLSearchParams({ status, ...(state?{state}:{}) , ...(op?{op}:{}) });
    const r = await fetch(`/api/admin/compliance/docs/list?${qs.toString()}`);
    const d = await r.json(); setRows(d.docs || []);
  }
  useEffect(() => { load(); }, [status, state, op]);

  async function act(id:string, action:'approve'|'reject', extra?: any) {
    setBusy(id);
    const r = await fetch(`/api/admin/compliance/docs/${id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action, ...extra })
    });
    setBusy(null);
    if (r.ok) load(); else alert('Action failed');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="border rounded-md px-2 py-1 text-sm" value={status} onChange={e=>setStatus(e.target.value as any)}>
          {['pending','approved','rejected','expired'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <Input placeholder="State (e.g., CA, NY)" className="w-28" value={state} onChange={e=>setState(e.target.value)} />
        <Input placeholder="Operation (MEHKO/COTTAGE/...)" className="w-48" value={op} onChange={e=>setOp(e.target.value)} />
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      {!rows.length ? <div className="text-sm text-muted-foreground">No documents.</div> : (
        <div className="rounded-2xl border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="py-2 px-3">Chef</th>
                <th className="py-2 px-3">Requirement</th>
                <th className="py-2 px-3">Kind</th>
                <th className="py-2 px-3">Issued</th>
                <th className="py-2 px-3">Expires</th>
                <th className="py-2 px-3">File</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const chef = r.merchants?.display_name || r.merchants?.name || 'Chef';
                const req = `${r.compliance_requirements?.juris_state}/${r.compliance_requirements?.operation_type}/${r.compliance_requirements?.code}`;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 px-3">{chef}</td>
                    <td className="py-2 px-3">{req}</td>
                    <td className="py-2 px-3">{r.kind || '-'}</td>
                    <td className="py-2 px-3">{r.issued_at || '-'}</td>
                    <td className="py-2 px-3">{r.expires_at || '-'}</td>
                    <td className="py-2 px-3">
                      {r.file_url ? <a className="underline" href={r.file_url} target="_blank">open</a> : '-'}
                    </td>
                    <td className="py-2 px-3">
                      {status==='pending' ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={busy===r.id}
                            onClick={()=>{
                              const issued = prompt('Issued date (YYYY-MM-DD) or blank', r.issued_at||'');
                              const expires = prompt('Expires date (YYYY-MM-DD) or blank', r.expires_at||'');
                              act(r.id,'approve',{ issued_at: issued || null, expires_at: expires || null });
                            }}
                          >Approve</Button>
                          <Button size="sm" variant="outline" disabled={busy===r.id}
                            onClick={()=>{
                              const note = prompt('Reason for rejection?') || '';
                              act(r.id,'reject',{ note });
                            }}
                          >Reject</Button>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
