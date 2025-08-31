'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Report = { warnings?: any[] };

export default function TemplateJsonEditor({ defaultTemplateId }: { defaultTemplateId?: string }) {
  const [templateId, setTemplateId] = React.useState(defaultTemplateId || '');
  const [raw, setRaw] = React.useState('');
  const [msg, setMsg] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<Report | null>(null);
  const [loading, setLoading] = React.useState(false);

  function toPretty(jsonish: unknown): string {
    try {
      if (typeof jsonish === 'string') return JSON.stringify(JSON.parse(jsonish), null, 2);
      return JSON.stringify(jsonish, null, 2);
    } catch {
      // return original string if not valid JSON
      return typeof jsonish === 'string' ? jsonish : JSON.stringify(jsonish);
    }
  }

  async function load() {
    if (!templateId) return;
    setLoading(true); setMsg(null); setReport(null);
    try {
      const r = await fetch(`/api/admin/templates/${templateId}/validate`, { method: 'GET' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'not found');

      const dataVal = j.row?.data;
      // If DB stored string, show it raw; if object, pretty-print it.
      setRaw(typeof dataVal === 'string' ? toPretty(dataVal) : toPretty(dataVal ?? {}));
    } catch (e: any) {
      setMsg(e.message || 'load failed');
    } finally {
      setLoading(false);
    }
  }

  async function validate() {
    if (!templateId) { setMsg('Template ID is required'); return; }
    if (!raw.trim()) { setMsg('Paste JSON first'); return; }
    setLoading(true); setMsg(null); setReport(null);
    try {
      const r = await fetch(`/api/admin/templates/${templateId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataJson: raw }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.formErrors?.join?.(', ') || j?.error || 'validate failed');

      setReport({ warnings: j.warnings || [] });
      // Show normalized template.data if available; otherwise keep original
      const next = j?.template?.data ?? j?.template ?? raw;
      setRaw(toPretty(next));
      setMsg('Validated ✔︎');
    } catch (e: any) {
      setMsg(e.message || 'validate failed');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!templateId) { setMsg('Template ID is required'); return; }
    if (!raw.trim()) { setMsg('Paste JSON first'); return; }
    setLoading(true); setMsg(null); setReport(null);
    try {
      const r = await fetch(`/api/admin/templates/${templateId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataJson: raw }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.formErrors?.join?.(', ') || j?.error || 'save failed');

      const next = j?.template?.data ?? j?.template ?? raw;
      setRaw(toPretty(next));
      setReport({ warnings: j.warnings || [] });
      setMsg('Saved 👍');
    } catch (e: any) {
      setMsg(e.message || 'save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-end gap-3">
        <div className="grow">
          <Label>Template ID</Label>
          <Input value={templateId} onChange={e=>setTemplateId(e.target.value)} placeholder="uuid…" />
        </div>
        <Button onClick={load} disabled={!templateId || loading}>Load</Button>
        <Button variant="secondary" onClick={validate} disabled={!templateId || !raw.trim() || loading}>Validate</Button>
        <Button onClick={save} disabled={!templateId || !raw.trim() || loading}>Save</Button>
      </div>

      <div>
        <Label>Template JSON</Label>
        <Textarea
          className="mt-1 min-h-[280px] font-mono text-xs"
          value={raw}
          onChange={(e)=>setRaw(e.target.value)}
          placeholder='{"meta":{...},"pages":[...]}  – or paste the raw data string from your DB'
        />
        {msg && <div className="mt-1 text-xs text-amber-600">{msg}</div>}
      </div>

      {report && (
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded border p-2">
            <div className="font-medium">Warnings</div>
            <ul className="mt-1 list-disc pl-4">{(report.warnings||[]).map((s,i)=><li key={i}>{String(s)}</li>)}</ul>
          </div>
          <div className="rounded border p-2">
            <div className="font-medium">Notes</div>
            <ul className="mt-1 list-disc pl-4">
              <li>Aliases like <code>services_grid → services</code>, <code>about → text</code> are applied.</li>
              <li><code>props → content</code> is migrated where needed.</li>
              <li>If pages are empty, a minimal Home page is injected.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
