'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';

export type PricingRow = {
  id?: string;
  provider: string;
  model_code: string;
  modality: 'chat'|'embeddings'|'image'|'audio_stt'|'audio_tts';
  input_per_1k_usd?: number | null;
  output_per_1k_usd?: number | null;
  image_base_usd?: number | null;
  image_per_mp_usd?: number | null;
  stt_per_min_usd?: number | null;
  tts_per_1k_chars_usd?: number | null;
  currency?: string;
  is_active?: boolean;
};

const MODALITIES: PricingRow['modality'][] = ['chat','embeddings','image','audio_stt','audio_tts'];

function NumberField({ value, onChange, placeholder }: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string }) {
  const [raw, setRaw] = useState(value == null ? '' : String(value));
  useEffect(()=>{ setRaw(value == null ? '' : String(value)); }, [value]);
  return (
    <Input
      value={raw}
      placeholder={placeholder}
      onChange={(e)=>{
        const v = e.target.value.trim();
        setRaw(v);
        if (v === '') return onChange(null);
        const num = Number(v);
        onChange(Number.isFinite(num) ? num : null);
      }}
    />
  );
}

export default function AiPricingPage() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [authz, setAuthz] = useState<'unknown' | 'ok' | 'forbidden'>('unknown');

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/ai-pricing', { cache: 'no-store' });
    if (r.status === 403) {
        setAuthz('forbidden');
        setRows([]);
        setLoading(false);
        return;
    }
    if (!r.ok) {
        toast.error('Failed to load pricing');
        setLoading(false);
        return;
    }
    const data = await r.json();
    setRows(data.rows || []);
    setAuthz('ok');
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function addBlank() {
    setRows((r) => [{ provider: '', model_code: '', modality: 'chat', currency: 'USD', is_active: true }, ...r]);
  }

  async function save(row: PricingRow) {
    if (!row.provider || !row.model_code || !row.modality) {
      toast.error('provider, model_code, modality are required');
      return;
    }
    setSavingId(row.id || `${row.provider}:${row.model_code}:${row.modality}`);
    const res = await fetch('/api/admin/ai-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const t = await res.text();
      toast.error(`Save failed: ${t}`);
    } else {
      toast.success('Saved');
      await load();
    }
    setSavingId(null);
  }

  async function remove(row: PricingRow) {
    if (!row.id) {
      // try delete by unique
      const qs = new URLSearchParams({ provider: row.provider, model_code: row.model_code, modality: row.modality }).toString();
      const res = await fetch(`/api/admin/ai-pricing?${qs}`, { method: 'DELETE' });
      if (!res.ok) toast.error('Delete failed'); else { toast.success('Deleted'); load(); }
      return;
    }
    const res = await fetch(`/api/admin/ai-pricing?id=${row.id}`, { method: 'DELETE' });
    if (!res.ok) toast.error('Delete failed'); else { toast.success('Deleted'); load(); }
  }

  {authz === 'forbidden' && (
    <div className="p-6">
      <Card className="mx-auto max-w-5xl mb-4">
        <CardHeader><CardTitle>AI Pricing</CardTitle></CardHeader>
        <CardContent>You must be an admin to view this page.</CardContent>
      </Card>
    </div>
  )}
  
  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">AI Model Pricing</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>
            <Button onClick={addBlank}>Add model</Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="text-sm underline" href="/admin/settings/ai-pricing/review">Review Changes</Link>
          <Button size="sm" onClick={async ()=>{
            await fetch('/api/admin/ai-pricing/sync/openai', { method: 'POST' });
            await load();
          }}>Sync OpenAI Pricing</Button>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 text-left">Provider</th>
                <th className="p-2 text-left">Model</th>
                <th className="p-2 text-left">Modality</th>
                <th className="p-2 text-left">Input/1k</th>
                <th className="p-2 text-left">Output/1k</th>
                <th className="p-2 text-left">Image (base)</th>
                <th className="p-2 text-left">Image (/MP)</th>
                <th className="p-2 text-left">STT (/min)</th>
                <th className="p-2 text-left">TTS (/1k chars)</th>
                <th className="p-2 text-left">Active</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={(row.id || i) + row.model_code} className="border-t">
                  <td className="p-2 min-w-[140px]"><Input value={row.provider||''} onChange={e=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, provider: e.target.value }; return c; })} placeholder="openai"/></td>
                  <td className="p-2 min-w-[180px]"><Input value={row.model_code||''} onChange={e=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, model_code: e.target.value }; return c; })} placeholder="gpt-4o-mini"/></td>
                  <td className="p-2 min-w-[140px]">
                    <select className="border rounded px-2 py-1 w-full" value={row.modality} onChange={e=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, modality: e.target.value as any }; return c; })}>
                      {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="p-2 w-[140px]"><NumberField value={row.input_per_1k_usd ?? null} onChange={v=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, input_per_1k_usd: v }; return c; })} placeholder="0.150"/></td>
                  <td className="p-2 w-[140px]"><NumberField value={row.output_per_1k_usd ?? null} onChange={v=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, output_per_1k_usd: v }; return c; })} placeholder="0.600"/></td>
                  <td className="p-2 w-[140px]"><NumberField value={row.image_base_usd ?? null} onChange={v=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, image_base_usd: v }; return c; })} placeholder="0.040"/></td>
                  <td className="p-2 w-[140px]"><NumberField value={row.image_per_mp_usd ?? null} onChange={v=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, image_per_mp_usd: v }; return c; })} placeholder="0.010"/></td>
                  <td className="p-2 w-[140px]"><NumberField value={row.stt_per_min_usd ?? null} onChange={v=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, stt_per_min_usd: v }; return c; })} placeholder="0.006"/></td>
                  <td className="p-2 w-[160px]"><NumberField value={row.tts_per_1k_chars_usd ?? null} onChange={v=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, tts_per_1k_chars_usd: v }; return c; })} placeholder="0.015"/></td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={row.is_active ?? true} onChange={e=>setRows(rs=>{ const c=[...rs]; c[i] = { ...row, is_active: e.target.checked }; return c; })} />
                  </td>
                  <td className="p-2 whitespace-nowrap text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" onClick={()=>save(row)} disabled={savingId !== null && (savingId === (row.id || `${row.provider}:${row.model_code}:${row.modality}`))}>{savingId ? 'Saving…' : 'Save'}</Button>
                      <Button size="sm" variant="destructive" onClick={()=>remove(row)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr><td className="p-4 text-center text-muted-foreground" colSpan={11}>No rows. Click “Add model”.</td></tr>
              )}
            </tbody>
          </table>
          <div className="mt-6 grid gap-3">
            <Card className="max-w-4xl">
                <CardHeader>
                <CardTitle>Import Pricing Text (OpenAI)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    1) Open <a className="underline" href="https://platform.openai.com/docs/pricing" target="_blank">OpenAI Pricing</a>.
                    2) In the browser console, run:<br/>
                    <code className="bg-muted px-2 py-1 rounded text-xs">
                    copy((document.querySelector('main')?.innerText || document.body.innerText || '').trim())
                    </code><br/>
                    3) Paste here, then “Queue for Review”. Changes will appear on the <em>Review</em> page.
                </p>
                <Textarea id="openai-import" className="min-h-[220px]" placeholder="Paste pricing text from the OpenAI page here…" />
                <div className="flex gap-2">
                    <Button size="sm" onClick={async () => {
                    const el = document.getElementById('openai-import') as HTMLTextAreaElement | null;
                    if (!el || !el.value.trim()) return toast.error('Paste the pricing text first.');
                    const r = await fetch('/api/admin/ai-pricing/import-openai', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: el.value }),
                    });
                    const j = await r.json();
                    if (!r.ok) return toast.error(j?.error || 'Import failed');
                    toast.success(`Queued ${j.queued} change(s) for review`);
                    el.value = '';
                    }}>Queue for Review</Button>
                    <Button size="sm" variant="outline" onClick={()=>window.open('/admin/settings/ai-pricing/review','_self')}>
                    Review Changes
                    </Button>
                </div>
                </CardContent>
            </Card>

            <details className="text-sm">
                <summary className="cursor-pointer underline">Bookmarklet (1-click copy)</summary>
                <div className="mt-2">
                Drag this to your bookmarks bar:
                <a className="ml-2 underline"
                    href={`javascript:(()=>{const t=(document.querySelector('main')?.innerText||document.body.innerText||'').trim();navigator.clipboard.writeText(t).then(()=>alert('Pricing text copied'));})();`}>
                    Copy OpenAI Pricing Text
                </a>
                </div>
            </details>
            </div>
        </div>
      </div>
    </div>
  );
}
