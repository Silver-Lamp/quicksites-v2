'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';
import type { BlockEditorProps } from './index'; // ✅ Reuse the shared type
import { extractFieldErrors } from '../utils/extractFieldErrors';

export default function ServicesEditor({ block, onSave, onClose, errors = {}, template }: BlockEditorProps) {
  const servicesBlock = block as unknown as Block;
  const [items, setItems] = useState(servicesBlock.content as unknown as any);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]); // now accepts Record<string, BlockValidationError[]>
  const updateItem = (i: number, v: string) => {
    const updated = [...items];
    updated[i] = v;
    setItems(updated);
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Services</h3>

      {items.map((item: any, i: number) => (
        <BlockField
          key={i}
          type="text"
          label={`Service ${i + 1}`}
          value={item}
          onChange={(v) => updateItem(i, v)}
        />
      ))}

      <div className="flex gap-2">
        <button onClick={() => setItems([...items, 'New Service'])} className="text-sm text-green-400 underline">
          + Add Service
        </button>
        {items.length > 1 && (
          <button onClick={() => setItems(items.slice(0, -1))} className="text-sm text-red-400 underline">
            − Remove Last
          </button>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...servicesBlock, content: { items } })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}