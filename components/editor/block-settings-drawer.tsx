// components/editor/BlockSettingsDrawer.tsx
'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import BlockField from '@/components/admin/templates/block-editors/block-field';
import type { Block } from '@/types/blocks';

export function BlockSettingsDrawer({
  block,
  onClose,
  onSave,
}: {
  block: Block;
  onClose: () => void;
  onSave: (updated: Block) => void;
}) {
  const [form, setForm] = useState(block.content || {});
  const [loadingAI, setLoadingAI] = useState(false);

  const update = (key: string, value: any) => {
    setForm((f: any) => ({ ...f, [key]: value }));
  };

  const handleAIFill = async () => {
    setLoadingAI(true);
    await new Promise((res) => setTimeout(res, 1000)); // placeholder
    setForm((f) => ({
      ...f,
      headline: 'AI-generated Headline',
      subheadline: 'This was created by AI.',
    }));
    setLoadingAI(false);
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 z-50 bg-neutral-900 border-l border-white/10 shadow-xl p-6 text-white overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Edit {block.type}</h2>
        <button onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {Object.entries(form).map(([key, value]) => (
        <BlockField
          key={key}
          type={typeof value === 'number' ? 'number' : 'text'}
          label={key}
          value={value}
          onChange={(v: any) => update(key, v)}
        />
      ))}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onSave({ ...block, content: form as any })}
          className="bg-green-600 px-4 py-2 text-sm rounded hover:bg-green-700"
        >
          Save
        </button>
        <button
          onClick={handleAIFill}
          className="flex items-center gap-1 text-sm px-3 py-2 bg-purple-600 rounded hover:bg-purple-700"
        >
          <Sparkles className="w-4 h-4" /> {loadingAI ? 'Thinking...' : 'AI Fill'}
        </button>
      </div>
    </div>
  );
}
