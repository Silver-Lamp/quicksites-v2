'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { persistServices } from '@/lib/templates/persistServices';
import { Sparkles } from 'lucide-react';

type Row = { id: string; value: string };
const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row_${Math.random().toString(36).slice(2)}`;

const clean = (vals: string[]) =>
  Array.from(new Set(vals.map((s) => s.trim()).filter(Boolean)));

export default function ServicesEditor({
  block,
  onSave,
  onClose,
  template,
}: BlockEditorProps) {
  const persisted = (template?.services ?? template?.data?.services ?? []) as string[];
  const toRows = (vals: string[]): Row[] => vals.map((v) => ({ id: makeId(), value: v }));

  const [draft, setDraft] = React.useState<Row[]>(toRows(persisted));
  const [touched, setTouched] = React.useState(false);

  const canSuggest = Boolean(template?.industry);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(toRows(persisted));
    setTouched(false);
  }, [JSON.stringify(persisted)]);

  const setRow = (id: string, value: string) => {
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
    setTouched(true);
  };
  const removeRow = (id: string) => {
    setDraft((prev) => prev.filter((r) => r.id !== id));
    setTouched(true);
  };
  const addRow = () => {
    setDraft((prev) => [...prev, { id: makeId(), value: '' }]);
    setTouched(true);
  };

  const cleanedDraft = clean(draft.map((r) => r.value));
  const cleanedPersisted = clean(persisted);
  const isDirty = touched && JSON.stringify(cleanedDraft) !== JSON.stringify(cleanedPersisted);

  const handleSave = async () => {
    const saved = await persistServices(template?.id as string, cleanedDraft);
    window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: { services: saved } }));
    onSave?.(block);
  };

  const handleCancel = () => {
    setDraft(toRows(persisted));
    setTouched(false);
    onClose?.();
  };

  // AI suggest
  const suggest = async (mode: 'append' | 'replace' = 'append', count = 6) => {
    if (!canSuggest || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch('/api/services/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template?.id,
          industry: template?.industry,
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
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Edit Services</h3>
        {canSuggest && (
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => suggest('append', 6)} disabled={aiBusy} className="h-8">
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
      {aiError && <div className="text-xs text-red-300">AI error: {aiError}</div>}

      <Label>Service Options (used by contact forms)</Label>
      <div className="space-y-2">
        {draft.map((row) => (
          <div key={row.id} className="flex gap-2 items-center">
            <Input
              value={row.value}
              placeholder="e.g., Roadside Assistance"
              onChange={(e) => setRow(row.id, e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1"
            />
            <button type="button" onClick={() => removeRow(row.id)} className="text-red-400 text-sm">
              Remove
            </button>
          </div>
        ))}

        <button type="button" onClick={addRow} className="text-sm text-green-400 underline">
          + Add Service
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        {isDirty && <span className="text-xs text-amber-300 mr-auto">Unsaved changes</span>}
        <Button type="button" variant="ghost" onClick={handleCancel} className="text-sm">
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={!isDirty} className="text-sm">
          Save
        </Button>
      </div>
    </div>
  );
}
