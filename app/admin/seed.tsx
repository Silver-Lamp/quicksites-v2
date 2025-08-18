// app/admin/seed.tsx
'use client';

import { useMemo, useState } from 'react';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SeedUploadPage() {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [preview, setPreview] = useState(''); // filename or path
  const [data, setData] = useState('');
  const [status, setStatus] = useState<SaveState>('idle');
  const [err, setErr] = useState<string>('');

  const parsed = useMemo(() => {
    if (!data.trim()) return { ok: true, value: null as any };
    try {
      return { ok: true, value: JSON.parse(data) };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Invalid JSON' };
    }
  }, [data]);

  const valid =
    id.trim().length > 0 &&
    name.trim().length > 0 &&
    (!data.trim() || parsed.ok);

  const fillDemo = () => {
    setId('starter-plumber');
    setName('Local Plumber Starter');
    setDesc('A quick-start template for plumbers with booking CTA and services list.');
    setTemplateId('tmpl_plumber_v1');
    setPreview('plumber-starter.webp');
    setData(JSON.stringify(
      {
        hero: { title: 'Fast, Friendly Plumbing', cta: 'Book a Visit' },
        services: ['Leak Repair', 'Drain Cleaning', 'Water Heaters'],
        theme: { color: '#0ea5e9' },
      },
      null,
      2
    ));
    setErr('');
    setStatus('idle');
  };

  const resetForm = () => {
    setId(''); setName(''); setDesc(''); setTemplateId(''); setPreview(''); setData('');
    setErr(''); setStatus('idle');
  };

  const handleSubmit = async () => {
    if (!valid) return;
    setStatus('saving');
    setErr('');

    try {
      const res = await fetch('/api/admin/seed-template', {
        method: 'POST',
        credentials: 'include', // keep auth cookies flowing
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name,
          description: desc || undefined,
          template_id: templateId || undefined,
          preview: preview || undefined,
          data: data ? JSON.parse(data) : {}, // send parsed object
        }),
        cache: 'no-store',
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || json?.message || 'Seed failed');
      }
      setStatus('saved');
    } catch (e: any) {
      setErr(e?.message || 'Unexpected error');
      setStatus('error');
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">🌱 Seed a Starter Template</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Create or update a starter template record used by the builder.
      </p>

      <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
        {/* ID / Name */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="tpl-id" className="text-sm font-medium">Template ID <span className="text-red-500">*</span></label>
            <input
              id="tpl-id"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g., starter-plumber"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Unique key used to reference this template.</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="tpl-name" className="text-sm font-medium">Name <span className="text-red-500">*</span></label>
            <input
              id="tpl-name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Description / Template ref */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="tpl-desc" className="text-sm font-medium">Description</label>
            <input
              id="tpl-desc"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Short blurb shown in the selector"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tpl-template-id" className="text-sm font-medium">Template Reference</label>
            <input
              id="tpl-template-id"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g., tmpl_plumber_v1"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional: internal template engine ID/version.
            </p>
          </div>
        </div>

        {/* Preview filename */}
        <div className="space-y-1">
          <label htmlFor="tpl-preview" className="text-sm font-medium">Preview filename</label>
          <input
            id="tpl-preview"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="e.g., plumber-starter.webp"
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Optional: filename or path accessible by the app.</p>
        </div>

        {/* JSON Data */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="tpl-data" className="text-sm font-medium">JSON Data</label>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-xs',
                !data
                  ? 'bg-muted text-muted-foreground'
                  : parsed.ok
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700',
              ].join(' ')}
            >
              {(!data && 'empty') || (parsed.ok ? 'valid JSON' : 'invalid JSON')}
            </span>
          </div>
          <textarea
            id="tpl-data"
            className="h-48 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder='{\n  "hero": { "title": "..." }\n}'
            value={data}
            onChange={(e) => setData(e.target.value)}
            spellCheck={false}
          />
          {data && parsed.ok && (
            <p className="text-xs text-muted-foreground">
              Keys: {Object.keys(parsed.value || {}).length} · Size: {new Blob([data]).size} bytes
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!valid || status === 'saving'}
            className={[
              'rounded-md px-4 py-2 text-sm',
              !valid || status === 'saving'
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'bg-blue-600 text-white hover:bg-blue-700',
            ].join(' ')}
          >
            {status === 'saving' ? 'Saving…' : status === 'saved' ? '✅ Saved!' : 'Save Template'}
          </button>

          <button
            type="button"
            onClick={fillDemo}
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm hover:bg-muted"
          >
            Fill demo values
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm hover:bg-muted"
          >
            Reset
          </button>

          {err && <span className="text-sm text-red-600">{err}</span>}
          {status === 'saved' && !err && (
            <span className="text-sm text-green-600">Template saved.</span>
          )}
        </div>
      </div>
    </div>
  );
}
