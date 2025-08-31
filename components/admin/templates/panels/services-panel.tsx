// components/admin/templates/panels/services-panel.tsx
'use client';

import * as React from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Template } from '@/types/template';
import { persistServices } from '@/lib/templates/persistServices';
import { Sparkles } from 'lucide-react';

type Row = { id: string; value: string };
const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row_${Math.random().toString(36).slice(2)}`;

export default function ServicesPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (updated: Template) => void;
}) {
  const persisted = (template.services ?? template.data?.services ?? []) as string[];
  const toRows = (vals: string[]): Row[] => vals.map((v) => ({ id: makeId(), value: v }));

  const [draft, setDraft] = React.useState<Row[]>(toRows(persisted));
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // AI state
  const canSuggest = Boolean(template.industry);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(toRows(persisted));
    setTouched(false);
  }, [JSON.stringify(persisted)]);

  const clean = (vals: string[]) =>
    Array.from(new Set(vals.map((s) => s.trim()).filter(Boolean)));

  const isDirty =
    touched &&
    JSON.stringify(clean(draft.map((r) => r.value))) !==
      JSON.stringify(clean(persisted));

  const save = async () => {
    const cleaned = clean(draft.map((r) => r.value));
    setSaving(true);
    try {
      const saved = await persistServices(template.id as string, cleaned);
      onChange({ ...template, services: saved });
      setDraft(toRows(saved));
      setTouched(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(toRows(persisted));
    setTouched(false);
  };

  // AI suggest helpers
  const suggest = async (mode: 'append' | 'replace' = 'append', count = 6) => {
    if (!canSuggest || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch('/api/services/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          industry: template.industry,
          city: (template as any)?.city,
          state: (template as any)?.state,
          count,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Suggest failed (${res.status})`);
      const suggested: string[] = Array.isArray(json?.services) ? json.services : [];
      const current = draft.map((r) => r.value);
      const merged = clean(mode === 'replace' ? suggested : [...current, ...suggested]);
      setDraft(toRows(merged));
      setTouched(true);
    } catch (e: any) {
      setAiError(e?.message || 'AI suggestion failed');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Collapsible title="Available Services" id="template-services">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {/* <Label>Service Options (used by contact forms)</Label> */}
          {canSuggest && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => suggest('append', 6)}
                disabled={aiBusy}
                className="h-8"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {aiBusy ? 'Suggesting…' : '✨ Suggest'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => suggest('replace', 8)}
                disabled={aiBusy}
                className="h-8"
                title="Replace with AI suggestions"
              >
                Replace w/ AI
              </Button>
            </div>
          )}
        </div>
        {aiError && (
          <div className="text-xs text-red-300">AI error: {aiError}</div>
        )}

        {draft.map((row) => (
          <div key={row.id} className="flex gap-2 items-center">
            <Input
              value={row.value}
              placeholder="e.g., Roadside Assistance"
              onChange={(e) => {
                const v = e.target.value;
                setDraft((prev) => prev.map((r) => (r.id === row.id ? { ...r, value: v } : r)));
                setTouched(true);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1"
            />
            <button
              type="button"
              onClick={() => {
                setDraft((prev) => prev.filter((r) => r.id !== row.id));
                setTouched(true);
              }}
              className="text-red-400 text-sm"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => { setDraft((p) => [...p, { id: makeId(), value: '' }]); setTouched(true); }}
          className="text-sm text-green-400 underline"
        >
          + Add Service
        </button>

        <div className="flex items-center justify-end gap-2 pt-2">
          {isDirty && <span className="text-xs text-amber-300 mr-auto">Unsaved changes</span>}
          <Button type="button" variant="ghost" onClick={cancel} disabled={!isDirty || saving} className="text-sm">
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={!isDirty || saving} className="text-sm">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Collapsible>
  );
}
