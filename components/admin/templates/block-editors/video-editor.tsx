'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import type { BlockEditorProps } from './index'; // ✅ Reuse the shared type

export default function VideoEditor({ block, onSave, onClose, errors = {}, template }: BlockEditorProps) {
  const videoBlock = block as unknown as Block;
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
      <BlockField
        type="text"
        label="Title (optional)"
        value={(content as any).title || ''}
        onChange={(v) => setContent({ ...content, title: v } as typeof content)}
        error={fieldErrors['content.title']}
      />
      <BlockField
        type="text"
        label="Poster image URL (the frame shown before play)"
        value={(content as any).poster || ''}
        onChange={(v) => setContent({ ...content, poster: v } as typeof content)}
        error={fieldErrors['content.poster']}
      />
      <label className="block text-sm">
        <span className="mb-1 block text-white/80">Orientation</span>
        <select
          className="w-full rounded border border-white/10 bg-neutral-900 px-3 py-2 text-white"
          value={(content as any).orientation === 'portrait' ? 'portrait' : 'landscape'}
          onChange={(e) => setContent({ ...content, orientation: e.target.value } as typeof content)}
        >
          <option value="landscape">Landscape — full width</option>
          <option value="portrait">Portrait — phone-shaped, centred</option>
        </select>
      </label>

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...videoBlock, content: content as unknown as typeof videoBlock.content })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}