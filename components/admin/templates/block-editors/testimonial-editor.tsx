'use client';

import { useState } from 'react';
import type { Block, TestimonialBlock } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';

type Props = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
  errors?: string[];
};

export default function TestimonialEditor({ block, onSave, onClose, errors = [] }: Props) {
  const tBlock = block as TestimonialBlock;
  const [content, setContent] = useState(tBlock.content);
  const fieldErrors = extractFieldErrors(errors);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Testimonial Block</h3>

      <BlockField
        type="text"
        label="Quote"
        value={content.quote}
        onChange={(v) => setContent({ ...content, quote: v })}
        error={fieldErrors['content.quote']}
      />

      <BlockField
        type="text"
        label="Attribution"
        value={content.attribution || ''}
        onChange={(v) => setContent({ ...content, attribution: v })}
        error={fieldErrors['content.attribution']}
      />

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...tBlock, content })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}