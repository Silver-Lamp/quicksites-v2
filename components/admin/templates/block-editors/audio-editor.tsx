'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import type { BlockEditorProps } from './index'; // ✅ Reuse the shared type

export default function AudioEditor({ block, onSave, onClose, errors = {}, template }: BlockEditorProps) {
  if (!('content' in block)) {
    throw new Error('Invalid block: missing content');
  }
  const audioBlock = block as unknown as Block;

  const [content, setContent] = useState(audioBlock.content);

  const fieldErrors = extractFieldErrors(errors as unknown as string[]); // now accepts Record<string, BlockValidationError[]>

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Audio Block</h3>

      <BlockField
        type="select"
        label="Provider"
        value={content.provider ?? 'spotify'}
        onChange={(v) => setContent({ ...content, provider: v as any })}
        options={['spotify', 'soundcloud', 'suno', 'file']}
        error={fieldErrors['content.provider']}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        “file” = a direct audio file (mp3, m4a, wav…) played in the browser’s own player. The others are embed URLs.
      </p>

      <BlockField
        type="text"
        label="URL"
        value={content.url}
        onChange={(v) => setContent({ ...content, url: v })}
        error={fieldErrors['content.url']}
      />

      <BlockField
        type="text"
        label="Title (optional)"
        value={content.title || ''}
        onChange={(v) => setContent({ ...content, title: v })}
        error={fieldErrors['content.title']}
      />

      <BlockField
        type="text"
        label="Caption (optional, one line under the title)"
        value={content.caption || ''}
        onChange={(v) => setContent({ ...content, caption: v })}
        error={fieldErrors['content.caption']}
      />

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...audioBlock, content: content as unknown as typeof audioBlock.content })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}