'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import { uploadToStorage } from '@/lib/uploadToStorage';
import { Switch } from '@/components/ui/switch';
import BlockPreviewToggle from '@/components/admin/ui/block-preview-toggle';
import toast from 'react-hot-toast';

const previewSizes = {
  desktop: 'max-w-full',
  tablet: 'max-w-xl',
  mobile: 'max-w-xs',
};

const positionStyles = {
  top: 'bg-top',
  center: 'bg-center',
  bottom: 'bg-bottom',
};

export default function HeroEditor({
  block,
  onSave,
  onClose,
  errors,
  template,
}: BlockEditorProps) {
  if (block.type !== 'hero') return null;

  const [local, setLocal] = useState(block.content as unknown as any);
  const [previewSize, setPreviewSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const update = <K extends keyof typeof local>(key: K, value: typeof local[K]) => {
    setLocal((prev: any) => ({ ...prev, [key]: value as unknown as typeof local[K] }));
  };

  const handleSave = () => {
    onSave({ ...block, content: local as unknown as typeof block.content });
    onClose();
  };

  const errorText = (field: string) =>
    errors?.[field]?.length ? <p className="text-sm text-red-400 mt-1">{errors[field][0].message}</p> : null;

  const inputClass = (field: string) =>
    `w-full p-2 rounded bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border ${
      errors?.[field]
        ? 'border-red-500 dark:border-red-400'
        : 'border-neutral-300 dark:border-neutral-600'
    }`;

  const resetImageOffsets = () => {
    update('image_x', undefined as unknown as typeof local['image_x']);
    update('image_y', undefined as unknown as typeof local['image_y']);
  };

  return (
    <div className="space-y-4 bg-black text-white border border-black p-4 rounded max-h-[90vh] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium mb-1">Headline</label>
        <input
          className={inputClass('content.headline')}
          value={(local as unknown as any).headline || ''}
          onChange={(e) => update('headline', e.target.value as unknown as typeof local['headline'])}
        />
        {errorText('content.headline')}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Subheadline</label>
        <input
          className={inputClass('content.subheadline')}
          value={(local as unknown as any).subheadline || ''}
          onChange={(e) => update('subheadline', e.target.value as unknown as typeof local['subheadline'])}
        />
        {errorText('content.subheadline')}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">CTA Text</label>
        <input
          className={inputClass('content.cta_text')}
          value={(local as unknown as any).cta_text || ''}
          onChange={(e) => update('cta_text', e.target.value as unknown as typeof local['cta_text'])}
        />
        {errorText('content.cta_text')}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">CTA Link</label>
        <input
          className={inputClass('content.cta_link')}
          value={(local as unknown as any).cta_link || ''}
          onChange={(e) => update('cta_link', e.target.value as unknown as typeof local['cta_link'])}
        />
        {errorText('content.cta_link')}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Image</label>
        {((local as unknown as any).image_url) && (
          <img
            src={(local as unknown as any).image_url}
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
              update('image_url', url as unknown as typeof local['image_url']);
            } catch (err: any) {
              toast.error(err.message || 'Upload failed');
            }
          }}
        />
        {errorText('content.image_url')}
      </div>

      {((local as unknown as any).image_url) && (
        <>
          <div className="pt-2">
            <label htmlFor="layoutMode" className="block text-sm font-medium mb-1">
              Layout Mode
            </label>
            <select
              id="layoutMode"
              value={(local as unknown as any).layout_mode || 'inline'}
              onChange={(e) => update('layout_mode', e.target.value as any)}
              className="w-full bg-neutral-800 text-white border border-neutral-600 rounded p-2"
            >
              <option value="inline">Inline Image</option>
              <option value="background">Image as Background</option>
              <option value="full_bleed">Full-Bleed Image</option>
            </select>
          </div>

          {((local as unknown as any).layout_mode === 'background' || (local as unknown as any) .layout_mode === 'full_bleed') && (
            <>
              <div className="pt-4">
                <label className="block text-sm font-medium mb-1">
                  Blur Amount <span className="text-xs text-gray-400">(0–30px)</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={(local as unknown as any).blur_amount ?? 8}
                  onChange={(e) => update('blur_amount', Number(e.target.value) as unknown as typeof local['blur_amount'])}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Current: {(local as unknown as any).blur_amount ?? 8}px
                </div>
              </div>

              <div className="pt-4">
                <label htmlFor="imageX" className="block text-sm font-medium mb-1">
                  Image X Offset (e.g. left, center, right, or 40%)
                </label>
                <input
                  id="imageX"
                  type="text"
                  className={inputClass('content.image_x')}
                  value={(local as unknown as any)  .image_x || ''}
                  onChange={(e) => update('image_x', Number(e.target.value) as unknown as typeof local['image_x'])}
                  placeholder="e.g. center"
                />
              </div>

              <div className="pt-2">
                <label htmlFor="imageY" className="block text-sm font-medium mb-1">
                  Image Y Offset (e.g. top, center, bottom, or 60%)
                </label>
                <input
                  id="imageY"
                  type="text"
                  className={inputClass('content.image_y')}
                  value={(local as unknown as any).image_y || ''}
                  onChange={(e) => update('image_y', Number(e.target.value) as unknown as typeof local['image_y'])}
                  placeholder="e.g. bottom"
                />
              </div>

              {((local as unknown as any).image_x || (local as unknown as any).image_y) && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={resetImageOffsets}
                    className="text-sm text-white px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Reset X/Y Offsets
                  </button>
                </div>
              )}

              {((local as unknown as any).layout_mode === 'full_bleed') && (
                <div className="flex items-center justify-between pt-2">
                  <label htmlFor="parallaxToggle" className="text-sm">
                    Enable parallax scroll
                  </label>
                  <Switch
                    id="parallaxToggle"
                    checked={(local as unknown as any).parallax_enabled ?? true}
                    onCheckedChange={(value) => update('parallax_enabled', value as unknown as typeof local['parallax_enabled'])}
                  />
                </div>
              )}

              <div className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium mb-1">Live Preview</label>
                  <select
                    value={previewSize}
                    onChange={(e) => setPreviewSize(e.target.value as 'desktop' | 'tablet' | 'mobile')}
                    className="text-sm bg-neutral-800 border border-neutral-600 rounded p-1"
                  >
                    <option value="desktop">Desktop</option>
                    <option value="tablet">Tablet</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </div>
                <div className={`relative rounded overflow-hidden border border-neutral-700 h-40 w-full mx-auto ${previewSizes[previewSize]} ${positionStyles[(local as unknown as any).image_position as keyof typeof positionStyles] || 'center'}`}>
                  <div
                    className="absolute inset-0 bg-cover"
                    style={{
                      backgroundImage: `url(${(local as unknown as any).image_url})`,
                      filter: `blur(${(local as unknown as any).blur_amount ?? 8}px) brightness(0.5)`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs backdrop-blur-sm bg-black/20">
                    Preview (blur + brightness)
                  </div>
                </div>
              </div>
            </>
          )}
        </>
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
