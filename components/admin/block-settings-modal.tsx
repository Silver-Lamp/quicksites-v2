'use client';

import { useState } from 'react';
import { SettingsSchema } from './settings-schema';
import { BLOCK_SETTING_SCHEMAS } from '@/constants/blockSchemas';

export default function BlockSettingsModal({
  blockId,
  settings,
  onClose,
  onSave,
}: {
  blockId: string;
  settings: Record<string, any>;
  onClose: () => void;
  onSave: (updated: Record<string, any>) => void;
}) {
  const [form, setForm] = useState(settings);
  const schema = BLOCK_SETTING_SCHEMAS[blockId] || {};

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-zinc-900 text-black dark:text-white p-6 rounded shadow w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Settings for: {blockId}</h2>

        <SettingsSchema
          schema={schema}
          values={form}
          onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
        />

        <div className="flex justify-between items-center mt-6">
          {Object.keys(schema).length > 0 && (
            <button
              onClick={() => {
                const reset = Object.fromEntries(
                  Object.entries(schema).map(([k, v]) => [k, v.default])
                );
                setForm(reset);
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Reset to defaults
            </button>
          )}

          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="text-sm text-gray-500 hover:underline">
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(form);
                onClose();
              }}
              className="text-sm bg-blue-600 text-white px-4 py-1 rounded"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
