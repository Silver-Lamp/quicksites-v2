'use client';
import { useState } from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import { uploadToStorage } from '@/lib/uploadToStorage';

type HeroBlock = Extract<Block, { type: 'hero' }>;
type HeroContent = HeroBlock['content'];

export default function HeroEditor({ block, onSave, onClose }: BlockEditorProps) {
  const heroBlock = block as HeroBlock;
  const [local, setLocal] = useState<HeroContent>(heroBlock.content || {});

  const handleSave = () => {
    onSave({ ...heroBlock, content: local });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Headline</label>
        <input
          className="w-full p-2 rounded bg-neutral-800 text-white"
          value={local.headline || ''}
          onChange={(e) => setLocal({ ...local, headline: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Subheadline</label>
        <input
          className="w-full p-2 rounded bg-neutral-800 text-white"
          value={local.subheadline || ''}
          onChange={(e) => setLocal({ ...local, subheadline: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">CTA Text</label>
        <input
          className="w-full p-2 rounded bg-neutral-800 text-white"
          value={local.cta_text || ''}
          onChange={(e) => setLocal({ ...local, cta_text: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">CTA Link</label>
        <input
          className="w-full p-2 rounded bg-neutral-800 text-white"
          value={local.cta_link || ''}
          onChange={(e) => setLocal({ ...local, cta_link: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Image</label>
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
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await uploadToStorage(file);
            setLocal({ ...local, image_url: url });
          }}
        />
      </div>
      <div className="flex gap-2 justify-end pt-4">
        <button onClick={onClose} className="text-sm px-4 py-2 border rounded">
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="text-sm px-4 py-2 bg-purple-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}
