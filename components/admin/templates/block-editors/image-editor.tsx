'use client';

import { useState } from 'react';
import type { Block, ImageBlock } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';

type Props = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
  errors?: string[];
};

export default function ImageEditor({ block, onSave, onClose, errors = [] }: Props) {
  const imageBlock = block as ImageBlock;
  const [content, setContent] = useState(imageBlock.content);
  const fieldErrors = extractFieldErrors(errors);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Image Block</h3>

      <BlockField
        type="text"
        label="Image URL"
        value={content.url}
        onChange={(v) => setContent({ ...content, url: v })}
        error={fieldErrors['content.url']}
      />

      <BlockField
        type="text"
        label="Alt Text"
        value={content.alt}
        onChange={(v) => setContent({ ...content, alt: v })}
        error={fieldErrors['content.alt']}
      />

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...imageBlock, content })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}