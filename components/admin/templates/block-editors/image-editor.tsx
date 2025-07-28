'use client';

import { useState } from 'react';
// import type { ImageBlock } from '@/types/blocks';
import type { Block } from '@/types/blocks';

import type { BlockEditorProps } from './index'; // ✅ Reuse the shared type
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';

export default function ImageEditor({ block, onSave, onClose, errors = {}, template }: BlockEditorProps) {
  const imageBlock = block as unknown as Block;
  const [content, setContent] = useState(imageBlock.content as unknown as any);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]); // now accepts Record<string, BlockValidationError[]>

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Image Block</h3>

      <BlockField
        type="text"
        label="Image URL"
        value={(content as unknown as any).url}
        onChange={(v) => setContent({ ...content, url: v as unknown as string })}
        error={fieldErrors['content.url'] as unknown as string}
      />

      <BlockField
        type="text"
        label="Alt Text"
        value={(content as unknown as any).alt}
        onChange={(v) => setContent({ ...content, alt: v })}
        error={fieldErrors['content.alt'] as unknown as string}
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