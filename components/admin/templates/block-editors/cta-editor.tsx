'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import BlockField from './block-field';
import CtaBlockRender from '@/components/admin/templates/render-blocks/cta'; // Live preview
import { cn } from '@/admin/lib/utils';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';

const SUGGESTED_URLS = ['/contact', '/get-quote', '/services', '/book-now'];

export default function CtaEditor({
  block,
  onSave,
  onClose,
  errors = {},
  template,
}: BlockEditorProps) {
  if (!('content' in block)) {
    throw new Error('Invalid block: missing content');
  }
  const ctaBlock = block as unknown as Block;
  const [content, setContent] = useState<typeof ctaBlock.content>(ctaBlock.content as unknown as typeof ctaBlock.content);
  const [errorsContent, setErrorsContent] = useState<{ label?: BlockValidationError[]; link?: BlockValidationError[] }>({});
  const fieldErrors = extractFieldErrors(errors as unknown as string[]);
  const update = <K extends keyof typeof ctaBlock.content>(key: K, value: typeof ctaBlock.content[K]) => {
    setContent((prev: typeof ctaBlock.content) => ({ ...prev, [key]: value }));
    setErrorsContent((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const nextErrors: typeof errorsContent = {};
    if (!content.label?.trim()) nextErrors.label = [{ message: 'Label is required', field: 'label' }];
    if (!content.link?.trim()) {
      nextErrors.link = [{ message: 'Link URL is required', field: 'link' }];
    } else if (!/^\/|^https?:\/\//.test(content.link)) {
      nextErrors.link = [{ message: 'Must start with / or http(s)://', field: 'link' }];
    }
    setErrorsContent(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ ...ctaBlock, content: content as unknown as typeof ctaBlock.content });
    onClose();
  };

  const isExternalLink = content.link?.startsWith('http');

  return (
    <div className="space-y-4 bg-black text-white border border-black p-4 rounded">
      <h3 className="text-lg font-semibold">Edit Call to Action</h3>

      <BlockField
        type="text"
        label="Label"
        value={content.label || ''}
        onChange={(v) => update('label', v)}
        error={errorsContent.label}
      />

      <BlockField
        type="text"
        label="Link URL"
        value={content.link || ''}
        onChange={(v) => update('link', v)}
        error={errorsContent.link}
        description={
          isExternalLink
            ? '🔗 External link (will open in new tab)'
            : '↩️ Internal link (on-site navigation)'
        }
      />

      {/* 💡 Suggested links */}
      <div className="text-xs text-white/70">
        Suggested Links:{' '}
        {SUGGESTED_URLS.map((url) => (
          <button
            key={url}
            onClick={() => update('link', url)}
            className="px-2 py-0.5 bg-white text-black rounded-full text-xs font-mono mr-2 mb-1 hover:bg-gray-200"
          >
            {url}
          </button>
        ))}
      </div>

      {/* 🔍 Live Preview */}
      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="text-sm text-white/70 mb-1">Live Preview:</p>
        <div className={cn('p-4 rounded bg-neutral-900 border border-white/10')}>
          <CtaBlockRender block={{ ...block, type: 'cta', content: content as unknown as typeof block.content }} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button
          onClick={onClose}
          className="text-sm px-4 py-2 border border-gray-500 rounded hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="text-sm px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Save
        </button>
      </div>
    </div>
  );
}
