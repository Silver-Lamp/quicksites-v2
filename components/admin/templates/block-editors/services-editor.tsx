// components/admin/templates/block-editors/services-editor.tsx
'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { persistServices } from '@/lib/templates/persistServices';

type Row = { id: string; value: string };

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row_${Math.random().toString(36).slice(2)}`;

export default function ServicesEditor({
  block,
  onSave,
  onClose,
  template,
}: BlockEditorProps) {
  // Read from DB column; show legacy JSON only as fallback for initial display
  const persisted = (template?.services ?? template?.data?.services ?? []) as string[];

  const toRows = (vals: string[]): Row[] => vals.map((v) => ({ id: makeId(), value: v }));

  const [draft, setDraft] = React.useState<Row[]>(toRows(persisted));
  const [touched, setTouched] = React.useState(false);

  // Reset when template (or its services) changes externally
  React.useEffect(() => {
    setDraft(toRows(persisted));
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const clean = (vals: string[]) =>
    Array.from(new Set(vals.map((s) => s.trim()).filter(Boolean)));

  const cleanedDraft = clean(draft.map((r) => r.value));
  const cleanedPersisted = clean(persisted);
  const isDirty =
    touched && JSON.stringify(cleanedDraft) !== JSON.stringify(cleanedPersisted);

  const handleSave = async () => {
    const saved = await persistServices(template?.id as string, cleanedDraft);
    // ensure preview picks up the change immediately (parent usually merges this)
    window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: { services: saved } }));
    onSave?.(block); // close editor; block.content is untouched
  };

  const handleCancel = () => {
    setDraft(toRows(persisted));
    setTouched(false);
    onClose?.();
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Services</h3>

      <Label>Service Options (used by contact forms)</Label>
      <div className="space-y-2">
        {draft.map((row) => (
          <div key={row.id} className="flex gap-2 items-center">
            <Input
              value={row.value}
              placeholder="e.g., Roadside Assistance"
              onChange={(e) => setRow(row.id, e.target.value)}
              onKeyDown={(e) => e.stopPropagation()} // prevent global hotkeys
              className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="text-red-400 text-sm"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="text-sm text-green-400 underline"
        >
          + Add Service
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        {isDirty && (
          <span className="text-xs text-amber-300 mr-auto">Unsaved changes</span>
        )}
        <Button type="button" variant="ghost" onClick={handleCancel} className="text-sm">
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isDirty}
          className="text-sm"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
