// components/admin/templates/block-editors/header-editor.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import NextImage from 'next/image';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import QuickLinksEditor from '@/components/admin/fields/quick-links-editor';
import FaviconUploader from '@/components/admin/favicon-uploader';

type Props = {
  block: Block;
  onSave: (updated: Block) => void | Promise<void>;
  onClose: () => void;
  errors?: Record<string, BlockValidationError[]>;
  template?: Template;
  isSaving?: boolean;
};

type FavBg = 'transparent' | 'accent' | 'white' | 'black';

function normalizeHeaderContent(input: any, fallbackLogo?: string) {
  const c = input ?? {};
  const logo_url: string = c.logo_url ?? c.logoUrl ?? c.url ?? fallbackLogo ?? '';
  const raw =
    Array.isArray(c.nav_items) ? c.nav_items :
    Array.isArray(c.navItems)  ? c.navItems  :
    Array.isArray(c.links)     ? c.links     : [];

  const nav_items = raw.map((l: any) => ({
    label: typeof l?.label === 'string' ? l.label : '',
    href: typeof l?.href === 'string' ? l.href : '',
    appearance: typeof l?.appearance === 'string' ? l.appearance : 'default',
  }));

  return { logo_url, nav_items };
}

/* ------------------- helpers ------------------- */

function emitPatch(patch: Partial<Template>) {
  try {
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
  } catch {}
}

// AI → File
function b64ToFile(b64: string, filename: string, mime = 'image/png'): File {
  const byteStr = atob(b64);
  const len = byteStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = byteStr.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

// draw to 32x32 PNG (cover)
async function rasterizeSquareFromBlob(srcBlob: Blob, size = 32) {
  if (typeof window === 'undefined') throw new Error('rasterizeSquareFromBlob must run in the browser');
  const url = URL.createObjectURL(srcBlob);
  try {
    const img = new window.Image();
    img.decoding = 'async';
    img.src = url;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });

    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;
    const scale = Math.max(size / iw, size / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);

    const dataUrl = canvas.toDataURL('image/png');
    return await (await fetch(dataUrl)).blob();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hexToRGB(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [109,40,217] as const; // #6D28D9 default
  return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] as const;
}

function fillFaviconBg(ctx: CanvasRenderingContext2D, bg: FavBg, accentHex: string) {
  if (bg === 'transparent') return;
  const [r,g,b] = bg === 'accent' ? hexToRGB(accentHex) :
                  bg === 'white'  ? [255,255,255] :
                                    [0,0,0];
  ctx.clearRect(0,0,32,32);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.beginPath();
  ctx.arc(16,16,16,0,Math.PI*2);
  ctx.fill();
}

async function downscaleToFavicon(srcBlob: Blob, bg: FavBg, accentHex: string) {
  const url = URL.createObjectURL(srcBlob);
  try {
    const img = new window.Image();
    img.decoding = 'async';
    img.src = url;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });

    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    fillFaviconBg(ctx, bg, accentHex);

    const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
    const scale = Math.max(32 / iw, 32 / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (32 - dw) / 2, dy = (32 - dh) / 2;

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);

    return await (await fetch(canvas.toDataURL('image/png'))).blob();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function blobToBase64(blob: Blob) {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function uploadFaviconViaAPI(templateId: string, pngBlob: Blob) {
  const png_base64 = await blobToBase64(pngBlob);
  const res = await fetch('/api/favicon/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId, png_base64 }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error || `Upload failed (${res.status})`);
  return j.url as string;
}

async function fetchAsBlob(url: string) {
  const r = await fetch(url, { credentials: 'omit' });
  if (!r.ok) throw new Error(`Fetch failed (${r.status})`);
  return await r.blob();
}

/* ------------------- component ------------------- */

export default function PageHeaderEditor({
  block,
  onSave,
  onClose,
  template,
  isSaving: isSavingProp,
}: Props) {
  if (block.type !== 'header') {
    return <div className="text-red-500">Invalid block type</div>;
  }

  // meta-first template normalization
  const normalizedTemplate = {
    ...template,
    pages: template?.pages ?? template?.data?.pages ?? [],
  };
  const meta = (template?.data as any)?.meta ?? {};
  const fallbackLogo =
    (typeof meta.logo_url === 'string' && meta.logo_url) ||
    (template as any)?.logo_url ||
    '';

  const initial = normalizeHeaderContent(block.content, fallbackLogo);
  const [logoUrl, setLogoUrl] = useState<string>(initial.logo_url);
  const [navItems, setNavItems] = useState<Array<{ label: string; href: string; appearance?: string }>>(
    initial.nav_items
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  // Business + industry (meta-first)
  const businessName = useMemo(
    () => String(meta?.business ?? meta?.siteTitle ?? (template as any)?.business_name ?? ''),
    [meta, template]
  );
  const industry = useMemo(
    () => String(meta?.industry ?? (template as any)?.industry ?? ''),
    [meta, template]
  );

  // favicon state
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [useInitials, setUseInitials] = useState(false);
  const [style, setStyle] = useState<'flat' | 'badge' | 'monogram' | 'emblem'>('flat');
  const [accentHex, setAccentHex] = useState('#6D28D9');
  const [transparentBG, setTransparentBG] = useState(true);

  const [faviconUrl, setFaviconUrl] = useState<string>(String(meta?.favicon_url ?? ''));
  const [favBg, setFavBg] = useState<FavBg>('transparent');
  useEffect(() => {
    setFaviconUrl(String(((template as any)?.data?.meta ?? {})?.favicon_url ?? ''));
  }, [template?.id]);

  const saving = Boolean(isSavingProp) || isSavingLocal;

  const areLinksValid =
    navItems.length === 0 || navItems.every((link) => link?.label?.trim?.() && link?.href?.trim?.());

  // storage upload
  const handleFileUpload = async (file: File): Promise<string> => {
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    const toUpload = isSvg
      ? file
      : await imageCompression(file, { maxSizeMB: 5.0, maxWidthOrHeight: 500, useWebWorker: true });

    const ext = (toUpload.name.split('.').pop() || 'png').toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from('logos').upload(fileName, toUpload, {
      cacheControl: '3600',
      upsert: false,
      contentType: isSvg ? 'image/svg+xml' : undefined,
    });
    if (error) throw new Error(error.message || 'Upload failed');

    const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // onDrop
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      setIsUploading(true);
      try {
        const url = await handleFileUpload(acceptedFiles[0]);
        setLogoUrl(url);
        // patch meta.logo_url immediately so the site can reuse the logo elsewhere
        emitPatch({ data: { ...(template?.data as any), meta: { ...(meta ?? {}), logo_url: url } }, logo_url: url });
        toast.success('Logo uploaded!');
      } catch (err) {
        console.error(err);
        toast.error('Upload failed');
      } finally {
        setIsUploading(false);
      }
    },
    accept: { 'image/png': [], 'image/jpeg': [], 'image/webp': [], 'image/svg+xml': [] },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
  });

  // AI logo generator
  const initials = useMemo(
    () =>
      (businessName ? businessName.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 3).toUpperCase() : ''),
    [businessName]
  );

  const generateIcon = async () => {
    setGenBusy(true);
    setGenError(null);
    try {
      const res = await fetch('/api/icon/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template?.id,
          business_name: businessName,
          industry,
          style,
          accent: accentHex,
          initials: useInitials ? initials : null,
          transparent: transparentBG,
          size: '1024x1024',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Generate failed (${res.status})`);
      }
      const { image_base64 } = await res.json();
      if (!image_base64) throw new Error('No image returned');

      const file = b64ToFile(image_base64, `icon-${Date.now()}.png`, 'image/png');
      const url = await handleFileUpload(file);
      setLogoUrl(url);
      emitPatch({ data: { ...(template?.data as any), meta: { ...(meta ?? {}), logo_url: url } }, logo_url: url });
      toast.success('Icon generated!');
    } catch (e: any) {
      console.error(e);
      setGenError(e?.message || 'Icon generation failed');
      toast.error('Icon generation failed');
    } finally {
      setGenBusy(false);
    }
  };

  const saveBlock = async () => {
    setIsSavingLocal(true);
    try {
      // keep block content minimal: logo_url + nav_items
      await onSave({
        ...block,
        content: {
          logo_url: logoUrl || undefined,
          nav_items: (navItems ?? []).map((l) => ({
            label: l.label?.trim() ?? '',
            href: l.href?.trim() ?? '',
            appearance: l.appearance ?? 'default',
          })),
        },
      });
      onClose();
    } finally {
      setIsSavingLocal(false);
    }
  };

  const canSave = areLinksValid && !saving;

  // Favicon from current logo
  const makeFaviconFromLogoHere = async () => {
    try {
      const logo = (meta?.logo_url as string) || logoUrl;
      if (!logo) { toast.error('Add a logo first'); return; }
      const logoBlob = await fetchAsBlob(logo);
      const ico32 = await downscaleToFavicon(logoBlob, favBg, accentHex);
      const url = await uploadFaviconViaAPI(template!.id as string, ico32);
      setFaviconUrl(url);
      // push into meta
      emitPatch({ data: { ...(template?.data as any), meta: { ...(meta ?? {}), favicon_url: url } } });
      toast.success('Favicon updated');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Favicon from logo failed');
    }
  };

  // AI 1024 → 32 → upload
  const generateFaviconAIHere = async () => {
    setGenBusy(true);
    try {
      const res = await fetch('/api/favicon/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template?.id,
          business_name: businessName,
          industry,
          size: '1024x1024',
          transparent: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Generate failed (${res.status})`);
      const b64 = json.image_base64 as string;
      const big = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });

      const ico32 = await downscaleToFavicon(big, favBg, accentHex);
      const url = await uploadFaviconViaAPI(template!.id as string, ico32);
      setFaviconUrl(url);
      emitPatch({ data: { ...(template?.data as any), meta: { ...(meta ?? {}), favicon_url: url } } });
      toast.success('Favicon generated');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'AI favicon failed');
    } finally {
      setGenBusy(false);
    }
  };

  return (
    <div className="relative flex max-h-[calc(100vh-8rem)] min-h-0 flex-col text-white">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-neutral-900/70 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Edit Page Header, Logo and Favicon</h3>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={saveBlock} disabled={!canSave} title={!areLinksValid ? 'Fill in link label + URL' : ''}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 overscroll-contain">
        <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-6">
          {/* LEFT: Logo */}
          <section className="lg:col-span-1 max-w-full space-y-3">
            <Label className="text-white">Logo</Label>
            <div
              {...getRootProps()}
              className="border border-dashed rounded-md p-4 text-center cursor-pointer bg-neutral-900 min-h-[120px] flex items-center justify-center"
            >
              <input {...getInputProps()} />
              {isUploading ? (
                <div className="flex items-center gap-2 text-neutral-300">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Uploading...
                </div>
              ) : logoUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <NextImage src={logoUrl} alt="Logo" width={100} height={100} className="h-16 w-auto object-contain" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoUrl('');
                      emitPatch({ data: { ...(template?.data as any), meta: { ...(meta ?? {}), logo_url: '' } }, logo_url: '' });
                    }}
                  >
                    Remove Logo
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-neutral-400">
                  Drag and drop a logo image here, or click to browse
                  <br />(PNG, JPG, SVG, WebP — Max 5MB)
                </p>
              )}
            </div>

            {/* AI Logo Generator */}
            <div className="rounded-lg border border-white/10 p-3 bg-neutral-900/70">
              <div className="text-sm font-medium mb-2">AI Logo Generator</div>
              <div className="space-y-2 text-sm">
                <div>
                  <Label className="text-white/80">Business</Label>
                  <div className="mt-1 text-white/90">{businessName || '—'}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-white/80">Style</Label>
                    <select
                      className="mt-1 w-full rounded border border-white/10 bg-neutral-950 px-2 py-1.5 text-sm"
                      value={style}
                      onChange={(e) => setStyle(e.target.value as any)}
                    >
                      <option value="flat">Flat / Minimal Mark</option>
                      <option value="badge">Badge / Emblem</option>
                      <option value="monogram">Monogram</option>
                      <option value="emblem">Emblematic Shape</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-white/80">Accent Color</Label>
                    <input
                      type="color"
                      value={accentHex}
                      onChange={(e) => setAccentHex(e.target.value)}
                      className="mt-1 h-9 w-full rounded border border-white/10 bg-neutral-950"
                      title={accentHex}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useInitials}
                    onChange={(e) => setUseInitials(e.target.checked)}
                    className="accent-purple-600"
                  />
                  Use initials {initials ? `(${initials})` : ''}
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={transparentBG}
                    onChange={(e) => setTransparentBG(e.target.checked)}
                    className="accent-purple-600"
                  />
                  Transparent background (PNG)
                </label>

                <Button className="mt-2 w-full" onClick={generateIcon} disabled={genBusy}>
                  {genBusy ? 'Generating…' : 'Generate Logo'}
                </Button>

                {genError && (
                  <div className="mt-2 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300">
                    {genError}
                  </div>
                )}
              </div>
            </div>

            {/* Favicon tools */}
            <div className="flex gap-2">
              <Button size="sm" onClick={generateFaviconAIHere} disabled={genBusy}>
                {genBusy ? 'Generating…' : 'AI Favicon'}
              </Button>
              <Button size="sm" variant="outline" onClick={makeFaviconFromLogoHere} disabled={!logoUrl} className="bg-neutral-900">
                From Logo
              </Button>
            </div>
            <div className="rounded-lg border border-white/10 p-3 bg-neutral-900/70">
              <FaviconUploader
                templateId={template?.id as string}
                currentUrl={faviconUrl}
                onUpload={(url: string) => {
                  setFaviconUrl(url);
                  emitPatch({ data: { ...(template?.data as any), meta: { ...(meta ?? {}), favicon_url: url } } });
                }}
                bucket="favicons"
                folder={`template-${template?.id as string}`}
              />
            </div>
          </section>

          {/* RIGHT: Links */}
          <section className="lg:col-span-2 min-w-0">
            <Label className="mb-2 block text-white">Navigation Links</Label>
            <div className="rounded-lg border border-white/10">
              <div className="max-h-[60vh] overflow-y-auto p-3 pr-4">
                <QuickLinksEditor
                  links={navItems}
                  onChange={setNavItems}
                  template={normalizedTemplate as Template}
                />
              </div>
            </div>

            {!areLinksValid && (
              <div className="mt-3 rounded border border-red-500 bg-red-900/40 p-3 text-sm text-red-300">
                ⚠️ Please complete all required navigation links before saving.
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 z-20 border-t border-white/10 bg-neutral-900/70 backdrop-blur px-6 py-3">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={saveBlock} disabled={!canSave} title={!areLinksValid ? 'Fill in link label + URL' : ''}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
