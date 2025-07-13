'use client';

import { useState } from 'react';
import type { Block, VideoBlock } from '@/types/blocks';
import BlockField from './block-field';

type Props = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
};

export default function VideoEditor({ block, onSave, onClose }: Props) {
  const videoBlock = block as VideoBlock;
  const [content, setContent] = useState(videoBlock.content);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Video Block</h3>

      <BlockField
        type="text"
        label="Video URL"
        value={content.url}
        onChange={(v) => setContent({ ...content, url: v })}
      />

      <BlockField
        type="text"
        label="Caption"
        value={content.caption || ''}
        onChange={(v) => setContent({ ...content, caption: v })}
      />

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...videoBlock, content })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}