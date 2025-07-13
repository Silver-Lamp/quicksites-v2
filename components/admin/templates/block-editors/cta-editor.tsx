'use client';

import { useState } from 'react';
import type { Block, CtaBlock } from '@/types/blocks';
import BlockField from './block-field';

type Props = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
};

export default function CtaEditor({ block, onSave, onClose }: Props) {
  const ctaBlock = block as CtaBlock;
  const [content, setContent] = useState(ctaBlock.content);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Call to Action</h3>

      <BlockField
        type="text"
        label="Label"
        value={content.label}
        onChange={(v) => setContent({ ...content, label: v })}
      />

      <BlockField
        type="text"
        label="Link URL"
        value={content.link}
        onChange={(v) => setContent({ ...content, link: v })}
      />

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...ctaBlock, content })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}