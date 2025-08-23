// panels/ServicesPanel.tsx
'use client';

import * as React from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Template } from '@/types/template';
import { persistServices } from '@/lib/templates/persistServices';

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
      // update local template so preview re-renders immediately
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

  return (
    <Collapsible title="Available Services" id="template-services">
      <div className="space-y-3">
        <Label>Service Options (used by contact forms)</Label>

        {draft.map((row, i) => (
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

        <button type="button" onClick={() => { setDraft((p) => [...p, { id: makeId(), value: '' }]); setTouched(true); }} className="text-sm text-green-400 underline">
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
