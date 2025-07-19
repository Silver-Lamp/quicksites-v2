'use client';

import { useState } from 'react';
import type { VideoBlock } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import type { BlockEditorProps } from './index'; // ✅ Reuse the shared type

export default function VideoEditor({ block, onSave, onClose, errors = {}, template }: BlockEditorProps) {
  const videoBlock = block as VideoBlock;
  const [content, setContent] = useState(videoBlock.content);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]); // now accepts Record<string, BlockValidationError[]>
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Video Block</h3>

      <BlockField
        type="text"
        label="Video URL"
        value={content.url}
        onChange={(v) => setContent({ ...content, url: v })}
        error={fieldErrors['content.url']}
      />
      <BlockField
        type="text"
        label="Caption"
        value={content.caption || ''}
        onChange={(v) => setContent({ ...content, caption: v })}
        error={fieldErrors['content.caption']}
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