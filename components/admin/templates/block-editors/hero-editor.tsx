'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import { uploadToStorage } from '@/lib/uploadToStorage';
import { Switch } from '@/components/ui/switch';
import BlockPreviewToggle from '@/components/admin/ui/block-preview-toggle';

type HeroBlock = Extract<Block, { type: 'hero' }>;
type HeroContent = HeroBlock['content'];

export default function HeroEditor({ block, onSave, onClose }: BlockEditorProps) {
  const heroBlock = block as HeroBlock;
  const [local, setLocal] = useState<HeroContent>(heroBlock.content || {});

  const update = <K extends keyof HeroContent>(key: K, value: HeroContent[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({ ...heroBlock, content: local });
    onClose();
  };

  return (
    <div className="space-y-4 text-white">
      <div>
        <label className="block text-sm font-medium text-white mb-1">Headline</label>
        <input
          className="w-full p-2 rounded bg-neutral-800 text-white border border-neutral-600"
          value={local.headline || ''}
          onChange={(e) => update('headline', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1">Subheadline</label>
        <input
          className="w-full p-2 rounded bg-neutral-800 text-white border border-neutral-600"
          value={local.subheadline || ''}
          onChange={(e) => update('subheadline', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1">CTA Text</label>
        <input
          className="w-full p-2 rounded bg-neutral-800 text-white border border-neutral-600"
          value={local.cta_text || ''}
          onChange={(e) => update('cta_text', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1">CTA Link</label>
        <input
          className="w-full p-2 rounded bg-neutral-800 text-white border border-neutral-600"
          value={local.cta_link || ''}
          onChange={(e) => update('cta_link', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1">Image</label>
        {local.image_url && (
          <img
            src={local.image_url}
            alt="Hero Image"
            className="mb-2 rounded shadow max-w-xs"
          />
        )}
        <input
          type="file"
          accept="image/*"
          className="text-sm text-gray-300 file:bg-purple-600 file:text-white file:rounded file:border-0 file:px-4 file:py-1 file:mr-2"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await uploadToStorage(file);
            update('image_url', url);
          }}
        />
      </div>

      {local.image_url && (
        <div className="flex items-center justify-between pt-2">
          <label htmlFor="bgToggle" className="text-sm text-white">
            Show image as background
          </label>
          <Switch
            id="bgToggle"
            checked={local.show_image_as_bg ?? false}
            onCheckedChange={(value) => update('show_image_as_bg', value)}
          />
        </div>
      )}

      <BlockPreviewToggle block={{ ...block, content: local }} />

      <div className="flex gap-2 justify-end pt-4">
        <button
          onClick={onClose}
          className="text-sm px-4 py-2 border border-gray-500 text-white rounded hover:bg-neutral-800"
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
