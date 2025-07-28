'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import type { BlockEditorProps } from './index'; // ✅ Reuse the shared type

export default function QuoteEditor({ block, onSave, onClose, errors = {}, template }: BlockEditorProps) {
  const quoteBlock = block as unknown as Block;
  const [content, setContent] = useState(quoteBlock.content);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]); // now accepts Record<string, BlockValidationError[]>

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Quote Block</h3>

      <BlockField
        type="text"
        label="Quote"
        value={content.text}
        onChange={(v) => setContent({ ...content, text: v })}
        error={fieldErrors['content.text']}
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
          onClick={() => onSave({ ...quoteBlock, content })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}