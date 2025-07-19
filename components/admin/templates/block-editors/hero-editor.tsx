'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import { uploadToStorage } from '@/lib/uploadToStorage';
import { Switch } from '@/components/ui/switch';
import BlockPreviewToggle from '@/components/admin/ui/block-preview-toggle';
import toast from 'react-hot-toast';

type HeroBlock = Extract<Block, { type: 'hero' }>;
type HeroContent = HeroBlock['content'];

export default function HeroEditor({
  block,
  onSave,
  onClose,
  errors,
  template,
}: BlockEditorProps) {
  const heroBlock = block as HeroBlock;
  const [local, setLocal] = useState<HeroContent>(heroBlock.content || {});

  const update = <K extends keyof HeroContent>(key: K, value: HeroContent[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({ ...heroBlock, content: local });
    onClose();
  };

  const errorText = (field: string) =>
    errors?.[field]?.length ? (
      <p className="text-sm text-red-400 mt-1">{errors[field][0].message}</p>
    ) : null;

  const inputClass = (field: string) =>
    `w-full p-2 rounded bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border ${
      errors?.[field]
        ? 'border-red-500 dark:border-red-400'
        : 'border-neutral-300 dark:border-neutral-600'
    }`;

  return (
    <div className="space-y-4 bg-black text-white border border-black p-4 rounded">
      <div>
        <label className="block text-sm font-medium mb-1">Headline</label>
        <input
          className={inputClass('content.headline')}
          value={local.headline || ''}
          onChange={(e) => update('headline', e.target.value)}
        />
        {errorText('content.headline')}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Subheadline</label>
        <input
          className={inputClass('content.subheadline')}
          value={local.subheadline || ''}
          onChange={(e) => update('subheadline', e.target.value)}
        />
        {errorText('content.subheadline')}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">CTA Text</label>
        <input
          className={inputClass('content.cta_text')}
          value={local.cta_text || ''}
          onChange={(e) => update('cta_text', e.target.value)}
        />
        {errorText('content.cta_text')}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">CTA Link</label>
        <input
          className={inputClass('content.cta_link')}
          value={local.cta_link || ''}
          onChange={(e) => update('cta_link', e.target.value)}
        />
        {errorText('content.cta_link')}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Image</label>
        {local.image_url && (
          <img
            src={local.image_url}
            alt="Hero"
            className="mb-2 rounded shadow max-w-xs"
          />
        )}
        <input
          type="file"
          accept="image/*"
          className="text-sm text-gray-700 dark:text-gray-300 file:bg-purple-600 file:text-white file:rounded file:border-0 file:px-4 file:py-1 file:mr-2"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const url = await uploadToStorage(file, `template-${template?.id}/hero`);
              update('image_url', url);
            } catch (err: any) {
              toast.error(err.message || 'Upload failed');
            }
          }}
        />
        {errorText('content.image_url')}
      </div>

      {local.image_url && (
        <div className="flex items-center justify-between pt-2">
          <label htmlFor="bgToggle" className="text-sm">
            Show image as background
          </label>
          <Switch
            id="bgToggle"
            checked={local.show_image_as_bg ?? false}
            onCheckedChange={(value) => update('show_image_as_bg', value)}
          />
        </div>
      )}

      <BlockPreviewToggle block={{ ...block, type: 'hero', content: local }} />

      <div className="flex gap-2 justify-end pt-4">
        <button
          onClick={onClose}
          className="text-sm px-4 py-2 border border-gray-400 dark:border-gray-500 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
