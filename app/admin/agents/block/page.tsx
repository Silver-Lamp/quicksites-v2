// app/admin/agents/block/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Play, Plus, Trash2, RefreshCw, Download, Save, Trash } from 'lucide-react';

/**
 * Agent Runner UI
 * - Build a field spec for qs-block-agent.ts
 * - Load field definitions from existing blocks via blockContentSchemaMap
 * - Live schema preview
 * - Presets (save/load/delete) via /api/agents/presets (Supabase-backed)
 * - One-click PR title
 * - Sends to /api/agents/block which executes qs-block-agent.ts server-side
 */

const FIELD_TYPES = [
  'string',
  'text',
  'number',
  'boolean',
  'url',
  'color',
  'enum',
  'array(string)',
  'array(number)',
  'array(url)',
  'array(object)',
  'object',
] as const;

type FieldRow = {
  name: string;
  type: string; // matches options above (string|enum|array(T)|...)
  label?: string;
  defaultValue?: string;
  options?: string; // comma-separated when type === 'enum'
};

type BlockKey = string;

type ExtractedField = { name: string; type: string; options?: string[] };

type ExtractedSchema = { key: BlockKey; fields: ExtractedField[] };

type Preset = { id: string; title: string; name: string; group: string; fields: FieldRow[]; created_at?: string };

function serializeFieldSpec(rows: FieldRow[]): string {
  return rows
    .filter((r) => r.name && r.type)
    .map((r) => {
      const base = `${r.name}:${r.type}`;
      const quals: string[] = [];
      if (r.label) quals.push(`label="${r.label.replace(/\\"/g, '\\\\"')}"`);
      if (r.defaultValue) quals.push(`default=${r.defaultValue}`);
      if (r.options && r.type.startsWith('enum'))
        quals.push(`options=${r.options.split(',').map((s) => s.trim()).join('|')}`);
      return quals.length ? `${base}(${quals.join(',')})` : base;
    })
    .join(', ');
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function BlockAgentPage() {
  // Core inputs
  const [name, setName] = useState('hours-of-operation');
  const [title, setTitle] = useState('Hours of Operation');
  const [group, setGroup] = useState('general');

  // Field builder
  const [rows, setRows] = useState<FieldRow[]>([
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'tz', type: 'string', label: 'Timezone' },
    { name: 'note', type: 'text', label: 'Note' },
    { name: 'alwaysOpen', type: 'boolean', label: 'Open 24/7' },
    { name: 'display_style', type: 'enum', label: 'Style', options: 'table, stack' },
    { name: 'days', type: 'array(object)', label: 'Days JSON' },
    { name: 'exceptions', type: 'array(object)', label: 'Exceptions JSON' },
  ]);

  // Toggles/overrides
  const [dryRun, setDryRun] = useState(true);
  const [noFiles, setNoFiles] = useState(false);
  const [commit, setCommit] = useState(false);
  const [openPr, setOpenPr] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [outPrefix, setOutPrefix] = useState('');
  const [registry, setRegistry] = useState('');
  const [schemaMap, setSchemaMap] = useState('');

  // Busy/logging
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState('');

  // Existing blocks + schema preview
  const [blockKeys, setBlockKeys] = useState<BlockKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<BlockKey>('');
  const [extracted, setExtracted] = useState<ExtractedSchema | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // Presets
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetTitle, setPresetTitle] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  useEffect(() => {
    // Load available block keys
    (async () => {
      try {
        const res = await fetch('/api/agents/blocks');
        const j = await res.json();
        setBlockKeys(j.keys || []);
      } catch {}
    })();
    // Load presets
    refreshPresets();
  }, []);

  async function refreshPresets() {
    try {
      const res = await fetch('/api/agents/presets');
      const j = await res.json();
      setPresets(j.items || []);
    } catch {}
  }

  async function loadSchema(key: string) {
    setSelectedKey(key);
    setExtracted(null);
    if (!key) return;
    setLoadingSchema(true);
    try {
      const res = await fetch(`/api/agents/block-schema?key=${encodeURIComponent(key)}`);
      const j = (await res.json()) as ExtractedSchema | { error: string };
      if ('error' in j) setExtracted(null);
      else setExtracted(j as ExtractedSchema);
    } catch {
      setExtracted(null);
    } finally {
      setLoadingSchema(false);
    }
  }

  function useExtractedFields() {
    if (!extracted) return;
    const mapped: FieldRow[] = extracted.fields.map((f) => ({
      name: f.name,
      type: f.type,
      label: capitalize(f.name.replace(/_/g, ' ')),
      options: f.type.startsWith('enum') ? (f.options || []).join(', ') : undefined,
    }));
    setRows(mapped);
    if (!name) setName(extracted.key);
    if (!title) setTitle(capitalize(extracted.key.replace(/[-_]/g, ' ')));
  }

  async function savePreset() {
    const body = { title: presetTitle || title, name, group, fields: rows };
    await fetch('/api/agents/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setPresetTitle('');
    await refreshPresets();
  }

  async function loadPreset(id: string) {
    setSelectedPreset(id);
    if (!id) return;
    const res = await fetch(`/api/agents/presets?id=${encodeURIComponent(id)}`);
    const j = await res.json();
    const p = j.item as Preset;
    if (!p) return;
    setName(p.name);
    setTitle(p.title);
    setGroup(p.group);
    setRows(p.fields || []);
  }

  async function deletePreset(id: string) {
    await fetch(`/api/agents/presets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (selectedPreset === id) setSelectedPreset('');
    await refreshPresets();
  }

  async function run() {
    setBusy(true);
    setLogs('');
    const fields = serializeFieldSpec(rows);
    const res = await fetch('/api/agents/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        title,
        group,
        fields,
        dryRun,
        noFiles,
        commit,
        openPr,
        prTitle,
        outPrefix,
        registry,
        schemaMap,
      }),
    });
    const data = await res.json();
    setLogs((data as any).logs || (data as any).error || '');
    setBusy(false);
  }

  const fieldSpecPreview = useMemo(() => serializeFieldSpec(rows), [rows]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">QuickSites Coding Agent</h1>
      </div>

      {/* Load from existing block */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">Load from existing block</div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-xl border px-3 py-2 bg-background min-w-64"
              value={selectedKey}
              onChange={(e) => loadSchema(e.target.value)}
            >
              <option value="">— Select a block —</option>
              {blockKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              disabled={!extracted}
              onClick={useExtractedFields}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <Download className="w-4 h-4" /> Use these fields
            </button>
          </div>
        </div>
        <div className="text-xs opacity-70">
          Reads <code>blockContentSchemaMap</code> to infer field types.
        </div>
        <div className="mt-3 rounded-xl border bg-muted/40 p-3">
          <div className="text-sm font-medium mb-2">Schema preview</div>
          <pre className="text-xs whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-auto">
            {loadingSchema ? 'Loading…' : extracted ? JSON.stringify(extracted, null, 2) : '—'}
          </pre>
        </div>
      </div>

      {/* Presets */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Presets</div>
          <div className="flex items-center gap-2">
            <input
              className="rounded-xl border px-3 py-2 bg-background"
              placeholder="Preset title"
              value={presetTitle}
              onChange={(e) => setPresetTitle(e.target.value)}
            />
            <button
              onClick={savePreset}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border px-3 py-2 bg-background min-w-64"
            value={selectedPreset}
            onChange={(e) => loadPreset(e.target.value)}
          >
            <option value="">— Load a preset —</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedPreset}
            onClick={() => deletePreset(selectedPreset)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <Trash className="w-4 h-4" /> Delete
          </button>
        </div>
        <div className="text-xs opacity-70">
          Presets are stored in Supabase (falls back to no-op if not configured).
        </div>
      </div>

      {/* Core inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="space-y-1">
          <div className="text-sm font-medium">Block Name (kebab-case)</div>
          <input
            className="w-full rounded-xl border px-3 py-2 bg-background"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="image-carousel"
          />
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">Title (label)</div>
          <input
            className="w-full rounded-xl border px-3 py-2 bg-background"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Image Carousel"
          />
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">Group</div>
          <input
            className="w-full rounded-xl border px-3 py-2 bg-background"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="media"
          />
        </label>
      </div>

      {/* Fields builder */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Fields</div>
          <button
            onClick={() => setRows((prev) => [...prev, { name: '', type: 'string' }])}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Field
          </button>
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <input
                className="md:col-span-2 rounded-xl border px-3 py-2 bg-background"
                placeholder="name"
                value={r.name}
                onChange={(e) =>
                  setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <select
                className="md:col-span-2 rounded-xl border px-3 py-2 bg-background"
                value={r.type}
                onChange={(e) =>
                  setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, type: e.target.value } : x)))
                }
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                className="md:col-span-3 rounded-xl border px-3 py-2 bg-background"
                placeholder="label (optional)"
                value={r.label || ''}
                onChange={(e) =>
                  setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))
                }
              />
              {r.type.startsWith('enum') ? (
                <input
                  className="md:col-span-3 rounded-xl border px-3 py-2 bg-background"
                  placeholder="enum options (comma-separated)"
                  value={r.options || ''}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, options: e.target.value } : x)))
                  }
                />
              ) : (
                <input
                  className="md:col-span-3 rounded-xl border px-3 py-2 bg-background"
                  placeholder="default (optional)"
                  value={r.defaultValue || ''}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, defaultValue: e.target.value } : x)))
                  }
                />
              )}
              <button
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                className="md:col-span-2 inline-flex items-center justify-center rounded-xl border px-3 py-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="text-xs opacity-70">
          Field spec preview (agent input):
          <code className="ml-2 px-2 py-1 rounded bg-muted/60">{fieldSpecPreview || '—'}</code>
        </div>
      </div>

      {/* Toggles + overrides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> <span>Dry run</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={noFiles} onChange={(e) => setNoFiles(e.target.checked)} />{' '}
          <span>Patch registries only</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={commit} onChange={(e) => setCommit(e.target.checked)} /> <span>Create commit</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={openPr} onChange={(e) => setOpenPr(e.target.checked)} /> <span>Open PR</span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label className="space-y-1">
          <div className="text-sm font-medium">PR Title (optional)</div>
          <input
            className="w-full rounded-xl border px-3 py-2 bg-background"
            value={prTitle}
            onChange={(e) => setPrTitle(e.target.value)}
            placeholder="feat(block): add <name> via agent runner"
          />
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">Out Prefix</div>
          <input
            className="w-full rounded-xl border px-3 py-2 bg-background"
            value={outPrefix}
            onChange={(e) => setOutPrefix(e.target.value)}
            placeholder="autogen"
          />
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">Registry Path</div>
          <input
            className="w-full rounded-xl border px-3 py-2 bg-background"
            value={registry}
            onChange={(e) => setRegistry(e.target.value)}
            placeholder="lib/renderBlockRegistry.ts"
          />
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">Schema Map Path</div>
          <input
            className="w-full rounded-xl border px-3 py-2 bg-background"
            value={schemaMap}
            onChange={(e) => setSchemaMap(e.target.value)}
            placeholder="admin/lib/zod/blockSchema.ts"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>Run Agent</span>
        </button>
        <button onClick={() => setRows([])} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2">
          <RefreshCw className="w-4 h-4" /> Reset Fields
        </button>
        <span className="text-xs opacity-70">
          Runs <code>qs-block-agent.ts</code> server-side with your arguments.
        </span>
      </div>

      {/* Logs */}
      <div className="rounded-2xl border p-4">
        <div className="text-sm font-medium mb-2">Logs</div>
        <pre className="text-xs whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-auto">{logs || '—'}</pre>
      </div>
    </div>
  );
}
