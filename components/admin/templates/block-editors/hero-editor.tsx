// components/admin/templates/block-editors/hero-editor.tsx
'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import type { Template } from '@/types/template';
import { uploadToStorage } from '@/lib/uploadToStorage';
import BlockPreviewToggle from '@/components/admin/ui/block-preview-toggle';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Sparkles, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const previewSizes = { desktop: 'max-w-full', tablet: 'max-w-xl', mobile: 'max-w-xs' };
const positionStyles = { top: 'bg-top', center: 'bg-center', bottom: 'bg-bottom' };

// Dark-mode standardized controls
const inputDark =
  'w-full rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white ' +
  'placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';
const selectDark =
  'w-full rounded-md border border-white/10 bg-neutral-950 px-2 py-2 text-sm text-white ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';
const rangeDark = 'w-full accent-violet-500';
const btnPrimary =
  'inline-flex items-center gap-2 rounded bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-sm text-white disabled:opacity-60';
const btnIndigo =
  'inline-flex items-center gap-2 rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm text-white disabled:opacity-60';
const btnGhost =
  'inline-flex items-center gap-1 rounded border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-white hover:bg-neutral-800 disabled:opacity-60';

function b64ToFile(b64: string, filename: string, mime = 'image/png'): File {
  const byteStr = atob(b64);
  const bytes = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function formatPhone(d: string) {
  if (d.length !== 10) return d;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

export default function HeroEditor({
  block,
  onSave,
  onClose,
  errors,
  template,
}: BlockEditorProps & { template: Template }) {
  if (block.type !== 'hero') return null;

  const [local, setLocal] = useState<any>(block.content ?? {});
  const [previewSize, setPreviewSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [forceMobilePreview, setForceMobilePreview] = useState(false);

  // AI (copy) state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFieldLoading, setAiFieldLoading] =
    useState<null | 'headline' | 'subheadline' | 'cta_text'>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI (image) state
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgSubject, setImgSubject] = useState(
    local?.image_subject || `${(template as any)?.industry || 'Local Services'} hero photo`
  );
  const [imgStyle, setImgStyle] = useState<'photo' | 'illustration' | '3d' | 'minimal'>('photo');

  const update = <K extends keyof typeof local>(key: K, value: (typeof local)[K]) =>
    setLocal((prev: any) => ({ ...prev, [key]: value as (typeof local)[K] }));

  const handleSave = () => {
    onSave({ ...block, content: local as typeof block.content });
    onClose();
  };

  const errorText = (field: string) =>
    errors?.[field]?.length ? (
      <p className="text-sm text-red-400 mt-1">{errors[field][0].message}</p>
    ) : null;

  const resetImageOffsets = () => {
    update('image_x', undefined as any);
    update('image_y', undefined as any);
  };

  async function requestSuggestions() {
    const res = await fetch('/api/hero/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: template?.id,
        industry: template?.industry,
        services: template?.services ?? [],
        business_name: (template as any)?.business_name,
        city: (template as any)?.city,
        state: (template as any)?.state,
      }),
    });
    if (!res.ok) throw new Error(`Suggest failed (${res.status})`);
    return (await res.json()) as {
      headline?: string;
      subheadline?: string;
      cta_text?: string;
    };
  }

  async function suggestAll() {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await requestSuggestions();
      if (data.headline) update('headline', data.headline);
      if (data.subheadline) update('subheadline', data.subheadline);
      if (data.cta_text) update('cta_text', data.cta_text);
      toast.success('Suggested copy applied');
    } catch (e: any) {
      setAiError(e?.message || 'Failed to fetch suggestions');
      toast.error('Could not get AI suggestions');
    } finally {
      setAiLoading(false);
    }
  }

  async function suggestOne(which: 'headline' | 'subheadline' | 'cta_text') {
    setAiFieldLoading(which);
    setAiError(null);
    try {
      const data = await requestSuggestions();
      if (data[which]) update(which, data[which] as any);
      toast.success(`Regenerated ${which.replace('_', ' ')}`);
    } catch (e: any) {
      setAiError(e?.message || 'Failed to regenerate');
      toast.error('Could not regenerate');
    } finally {
      setAiFieldLoading(null);
    }
  }

  async function generateHeroImage() {
    setImgLoading(true);
    setImgError(null);
    try {
      const res = await fetch('/api/hero/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template?.id,
          industry: template?.industry,
          services: template?.services ?? [],
          business_name: (template as any)?.business_name,
          city: (template as any)?.city,
          state: (template as any)?.state,
          subject: imgSubject,
          style: imgStyle,
          aspect: 'wide',
        }),
      });
      if (!res.ok) throw new Error(`Image generate failed (${res.status})`);
      const { image_base64 } = await res.json();
      if (!image_base64) throw new Error('No image returned');

      const file = b64ToFile(image_base64, `hero-${Date.now()}.png`, 'image/png');
      const url = await uploadToStorage(file, `template-${template?.id}/hero`);
      update('image_url', url as any);
      toast.success('Hero image generated');
    } catch (e: any) {
      setImgError(e?.message || 'Failed to generate image');
      toast.error('Could not generate image');
    } finally {
      setImgLoading(false);
    }
  }

  // derive phone for CTA call override hint
  const dbPhoneDigits = (template?.phone || '').replace(/\D/g, '');

  return (
    <div
      className="space-y-4 bg-black text-white border border-black p-4 rounded max-h-[90vh] overflow-y-auto"
      onKeyDownCapture={(e) => e.stopPropagation()}
    >
      {/* AI Assist header */}
      <div className="rounded border border-white/10 bg-neutral-900 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-300" />
            <div className="text-sm font-medium">AI Assist</div>
          </div>
        </div>
        {aiError && <div className="text-xs text-red-300">{aiError}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={suggestAll} disabled={aiLoading} className={btnPrimary}>
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? 'Working…' : 'Suggest All'}
          </button>

          <button
            type="button"
            className={btnGhost}
            onClick={() => suggestOne('headline')}
            disabled={aiFieldLoading === 'headline'}
            title="Regenerate headline"
          >
            {aiFieldLoading === 'headline' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Headline
          </button>

          <button
            type="button"
            className={btnGhost}
            onClick={() => suggestOne('subheadline')}
            disabled={aiFieldLoading === 'subheadline'}
            title="Regenerate subheadline"
          >
            {aiFieldLoading === 'subheadline' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Subheadline
          </button>

          <button
            type="button"
            className={btnGhost}
            onClick={() => suggestOne('cta_text')}
            disabled={aiFieldLoading === 'cta_text'}
            title="Regenerate CTA"
          >
            {aiFieldLoading === 'cta_text' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            CTA
          </button>
        </div>

        {/* Image generator controls */}
        <div className="grid md:grid-cols-3 gap-3 pt-3">
          <div className="md:col-span-2">
            <label className="text-xs text-neutral-300">Image Subject</label>
            <input
              className={inputDark}
              value={imgSubject}
              onChange={(e) => setImgSubject(e.target.value)}
              placeholder="e.g., Tow truck on highway at dusk"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-300">Style</label>
            <select className={selectDark} value={imgStyle} onChange={(e) => setImgStyle(e.target.value as any)}>
              <option value="photo">Photo</option>
              <option value="illustration">Illustration</option>
              <option value="3d">3D Render</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <button onClick={generateHeroImage} disabled={imgLoading} className={btnIndigo}>
              {imgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              {imgLoading ? 'Generating…' : 'Generate Hero Image'}
            </button>
            {imgError && <div className="text-xs text-red-300 mt-1">{imgError}</div>}
          </div>
        </div>
      </div>

      {/* Headline */}
      <div>
        <label className="block text-sm font-medium mb-1">Headline</label>
        <input
          className={inputDark}
          value={local?.headline || ''}
          onChange={(e) => update('headline', e.target.value as any)}
          placeholder="Fast, Reliable Towing"
        />
        {errorText('content.headline')}
      </div>

      {/* Subheadline */}
      <div>
        <label className="block text-sm font-medium mb-1">Subheadline</label>
        <input
          className={inputDark}
          value={local?.subheadline || ''}
          onChange={(e) => update('subheadline', e.target.value as any)}
          placeholder="24/7 local service with transparent pricing and quick arrival."
        />
        {errorText('content.subheadline')}
      </div>

      {/* CTA Text */}
      <div>
        <label className="block text-sm font-medium mb-1">CTA Text</label>
        <input
          className={inputDark}
          value={local?.cta_text || ''}
          onChange={(e) => update('cta_text', e.target.value as any)}
          placeholder="Get Help Now"
        />
        {errorText('content.cta_text')}
      </div>

      {/* CTA Action */}
      <div className="rounded border border-white/10 bg-neutral-900 p-3 space-y-3">
        <div className="text-sm font-medium">CTA Action</div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-neutral-300">Action</label>
            <select
              className={selectDark}
              value={local?.cta_action || 'go_to_page'}
              onChange={(e) => update('cta_action', e.target.value as any)}
            >
              <option value="jump_to_contact">Jump to Contact (on this page)</option>
              <option value="go_to_page">Go to /contact (or URL)</option>
              <option value="call_phone">Call Business Phone</option>
            </select>
          </div>

          {/* when go_to_page */}
          {((local?.cta_action || 'go_to_page') === 'go_to_page') && (
            <div className="md:col-span-2">
              <label className="text-xs text-neutral-300">Contact Page URL</label>
              <input
                className={inputDark}
                value={local?.cta_link ?? '/contact'}
                onChange={(e) => update('cta_link', e.target.value as any)}
                placeholder="/contact"
              />
            </div>
          )}

          {/* when jump_to_contact */}
          {local?.cta_action === 'jump_to_contact' && (
            <div className="md:col-span-2">
              <label className="text-xs text-neutral-300">Contact Anchor ID</label>
              <input
                className={inputDark}
                value={local?.contact_anchor_id ?? 'contact'}
                onChange={(e) => update('contact_anchor_id', e.target.value as any)}
                placeholder="contact"
              />
              <p className="text-xs text-neutral-400 mt-1">
                Must match the contact form section id (defaults to <code>contact</code>).
              </p>
            </div>
          )}

          {/* when call_phone */}
          {local?.cta_action === 'call_phone' && (
            <div className="md:col-span-2">
              <label className="text-xs text-neutral-300">Phone (optional override)</label>
              <input
                className={inputDark}
                value={local?.cta_phone ?? ''}
                onChange={(e) => update('cta_phone', e.target.value as any)}
                placeholder={dbPhoneDigits ? `defaults to ${dbPhoneDigits}` : 'enter 10-digit phone'}
              />
              <p className="text-xs text-neutral-400 mt-1">
                If empty, we’ll use the business phone from Template Identity.
              </p>
            </div>
          )}
          <div className="md:col-span-3 flex items-center justify-between pt-1">
            <label htmlFor="ctaShowPhone" className="text-sm text-neutral-200">
              Show phone number under CTA
            </label>
            <Switch
              id="ctaShowPhone"
              checked={!!local?.cta_show_phone_below}
              onCheckedChange={(v) => update('cta_show_phone_below', v as any)}
            />
          </div>
          <p className="text-xs text-neutral-400">
            Uses the phone from Template Identity{(template?.phone || '').replace(/\D/g, '') ? ` (${formatPhone((template?.phone || '').replace(/\D/g, ''))})` : ''}.
          </p>
        </div>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium mb-1">Image</label>
        {local?.image_url && <img src={local.image_url} alt="Hero" className="mb-2 rounded shadow max-w-xs" />}
        <input
          type="file"
          accept="image/*"
          className="text-sm text-gray-300 file:bg-purple-600 file:text-white file:rounded file:border-0 file:px-4 file:py-1 file:mr-2"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const url = await uploadToStorage(file, `template-${template?.id}/hero`);
              update('image_url', url as any);
              toast.success('Image uploaded');
            } catch (err: any) {
              toast.error(err.message || 'Upload failed');
            }
          }}
        />
        {errorText('content.image_url')}
      </div>

      {/* Image layout & effects */}
      {local?.image_url && (
        <>
          <div className="pt-2">
            <label htmlFor="layoutMode" className="block text-sm font-medium mb-1">
              Layout Mode
            </label>
            <select
              id="layoutMode"
              value={local?.layout_mode || 'inline'}
              onChange={(e) => update('layout_mode', e.target.value as any)}
              className={selectDark}
            >
              <option value="inline">Inline Image</option>
              <option value="background">Image as Background</option>
              <option value="full_bleed">Full-Bleed Image</option>
              <option value="natural_height">Use Natural Image Height</option>
            </select>
          </div>

          {local?.layout_mode === 'natural_height' && (
            <div className="pt-2 text-sm text-neutral-400">
              This mode renders the full image using its original height. Check mobile sizes.
            </div>
          )}

          {['background', 'full_bleed'].includes(local?.layout_mode) && (
            <>
              <div className="pt-4">
                <label className="block text-sm font-medium mb-1">
                  Blur Amount <span className="text-xs text-neutral-400">(0–30px)</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={local?.blur_amount ?? 8}
                  onChange={(e) => update('blur_amount', Number(e.target.value) as any)}
                  className={rangeDark}
                />
                <div className="text-xs text-neutral-400 mt-1">Current: {local?.blur_amount ?? 8}px</div>
              </div>

              <div className="pt-4">
                <label htmlFor="imageX" className="block text-sm font-medium mb-1">
                  Image X Offset (e.g., left, center, right, or 40%)
                </label>
                <input
                  id="imageX"
                  type="text"
                  className={inputDark}
                  value={local?.image_x || ''}
                  onChange={(e) => update('image_x', e.target.value as any)}
                  placeholder="center"
                />
              </div>

              <div className="pt-2">
                <label htmlFor="imageY" className="block text-sm font-medium mb-1">
                  Image Y Offset (e.g., top, center, bottom, or 60%)
                </label>
                <input
                  id="imageY"
                  type="text"
                  className={inputDark}
                  value={local?.image_y || ''}
                  onChange={(e) => update('image_y', e.target.value as any)}
                  placeholder="bottom"
                />
              </div>

              {(local?.image_x || local?.image_y) && (
                <div className="pt-2">
                  <button type="button" onClick={resetImageOffsets} className={btnGhost}>
                    Reset X/Y Offsets
                  </button>
                </div>
              )}

              {local?.layout_mode === 'full_bleed' && (
                <div className="flex items-center justify-between pt-2">
                  <label htmlFor="parallaxToggle" className="text-sm">
                    Enable parallax scroll
                  </label>
                  <Switch
                    id="parallaxToggle"
                    checked={local?.parallax_enabled ?? true}
                    onCheckedChange={(v) => update('parallax_enabled', v as any)}
                  />
                </div>
              )}

              {/* Live preview */}
              <div className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Live Preview</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={previewSize}
                      onChange={(e) => setPreviewSize(e.target.value as 'desktop' | 'tablet' | 'mobile')}
                      className={selectDark}
                    >
                      <option value="desktop">Desktop</option>
                      <option value="tablet">Tablet</option>
                      <option value="mobile">Mobile</option>
                    </select>
                    <label className="text-xs flex items-center gap-1">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={forceMobilePreview}
                        onChange={(e) => setForceMobilePreview(e.target.checked)}
                      />
                      Force Mobile Layout
                    </label>
                  </div>
                </div>

                <div
                  className={clsx(
                    'relative rounded overflow-hidden border border-neutral-700 h-40 w-full mx-auto',
                    previewSizes[previewSize],
                    positionStyles[(local.image_position as keyof typeof positionStyles) || 'center'],
                    forceMobilePreview && 'max-w-xs'
                  )}
                >
                  <div
                    className="absolute inset-0 bg-cover"
                    style={{
                      backgroundImage: `url(${local.image_url})`,
                      filter: `blur(${local?.blur_amount ?? 8}px) brightness(0.5)`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs backdrop-blur-sm bg-black/20">
                    {forceMobilePreview ? 'Mobile Layout Mode' : 'Preview (blur + brightness)'}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <BlockPreviewToggle
        block={{ ...block, type: 'hero', content: local as typeof block.content }}
        template={template as Template}
      />

      <div className="flex gap-2 justify-end pt-4">
        <button
          onClick={onClose}
          className="text-sm px-4 py-2 border border-white/10 rounded bg-neutral-900 hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button onClick={handleSave} className="text-sm px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
          Save
        </button>
      </div>
    </div>
  );
}
