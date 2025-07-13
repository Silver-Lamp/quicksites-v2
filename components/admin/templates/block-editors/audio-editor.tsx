'use client';

import { useState } from 'react';
import type { Block, AudioBlock } from '@/types/blocks';
import BlockField from './block-field';

type Props = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
};

export default function AudioEditor({ block, onSave, onClose }: Props) {
  const audioBlock = block as AudioBlock;
  const [content, setContent] = useState(audioBlock.content);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Audio Block</h3>

      <BlockField
        type="select"
        label="Provider"
        value={content.provider ?? 'spotify'}
        onChange={(v) => setContent({ ...content, provider: v as any })}
        options={['spotify', 'soundcloud', 'suno']}
        />


      <BlockField
        type="text"
        label="URL"
        value={content.url}
        onChange={(v) => setContent({ ...content, url: v })}
      />

      <BlockField
        type="text"
        label="Title (optional)"
        value={content.title || ''}
        onChange={(v) => setContent({ ...content, title: v })}
      />

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...audioBlock, content })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}