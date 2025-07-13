'use client';

import { useState } from 'react';
import type { Block, TextBlock } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';

type Props = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
  errors?: string[];
};

export default function TextEditor({ block, onSave, onClose, errors = [] }: Props) {
  const textBlock = block as TextBlock;
  const [value, setValue] = useState(textBlock.content.value);

  const fieldErrors = extractFieldErrors(errors);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Text Block</h3>

      <BlockField
        type="text"
        label="Text Content"
        value={value}
        onChange={setValue}
        error={fieldErrors['content.value']}
      />

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...textBlock, content: { value } })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}