'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import type { BlockEditorProps } from './index'; // ✅ Reuse the shared type

export default function ButtonEditor({ block, onSave, onClose, errors = {}, template }: BlockEditorProps) {
  const buttonBlock = block as unknown as Block;
  const [content, setContent] = useState(buttonBlock.content as unknown as typeof buttonBlock.content);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]); // now accepts Record<string, BlockValidationError[]>

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Button Block</h3>

      <BlockField
        type="text"
        label="Label"
        value={content.label}
        onChange={(v) => setContent({ ...content, label: v })}
        error={fieldErrors['content.label']}
      />

      <BlockField
        type="text"
        label="Link URL"
        value={content.href}
        onChange={(v) => setContent({ ...content, href: v })}
        error={fieldErrors['content.href']}
      />

      <BlockField
        type="select"
        label="Style"
        value={content.style || 'primary'}
        onChange={(v) => setContent({ ...content, style: v as any })}
        options={['primary', 'secondary', 'ghost']}
      />

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...buttonBlock, content: content as unknown as typeof buttonBlock.content })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}