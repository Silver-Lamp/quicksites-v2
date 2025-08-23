// components/admin/templates/block-editors/header-editor.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
// import Image from 'next/image';
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

// tiny helper for AI → File
function b64ToFile(b64: string, filename: string, mime = 'image/png'): File {
  const byteStr = atob(b64);
  const len = byteStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = byteStr.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

// --- helpers inside header editor component file ---


// draw to 32x32 PNG (cover)
async function rasterizeSquareFromBlob(srcBlob: Blob, size = 32) {
  if (typeof window === 'undefined') throw new Error('rasterizeSquareFromBlob must run in the browser');
  const url = URL.createObjectURL(srcBlob);
  try {
    // Use DOM image constructor, not next/image component
    const img = new window.Image(); // or: document.createElement('img')
    img.decoding = 'async';
    img.src = url;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = (e) => rej(e);
    });

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
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

    // convert to Blob
    const dataUrl = canvas.toDataURL('image/png');
    return await (await fetch(dataUrl)).blob();
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Build a 32x32 favicon, optionally with a background before drawing the icon.
type FavBg = 'transparent' | 'accent' | 'white' | 'black';

function hexToRGB(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [109,40,217] as const; // default #6D28D9
  return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] as const;
}

// Draw a background (circle) if requested
function fillFaviconBg(ctx: CanvasRenderingContext2D, bg: FavBg, accentHex: string) {
  if (bg === 'transparent') return;
  const [r,g,b] = bg === 'accent' ? hexToRGB(accentHex) :
                  bg === 'white'  ? [255,255,255] :
                                    [0,0,0]; // black
  ctx.clearRect(0,0,32,32);
  // nice circle background
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.beginPath();
  ctx.arc(16,16,16,0,Math.PI*2);
  ctx.fill();
}

// Draw a blob onto a 32x32 canvas with 'cover' and optional background
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

    // background first (if any)
    fillFaviconBg(ctx, bg, accentHex);

    // cover draw
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

// Convert Blob → raw base64 (no data: prefix)
async function blobToBase64(blob: Blob) {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Upload to our server helper (sets meta.favicon_url)
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

// Simple fetch to blob (avoids taint)
async function fetchAsBlob(url: string) {
  const r = await fetch(url, { credentials: 'omit' });
  if (!r.ok) throw new Error(`Fetch failed (${r.status})`);
  return await r.blob();
}

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

  const normalizedTemplate = {
    ...template,
    pages: template?.pages ?? template?.data?.pages ?? [],
  };

  const initial = normalizeHeaderContent(block.content, (template as any)?.logo_url);
  const [logoUrl, setLogoUrl] = useState<string>(initial.logo_url);
  const [navItems, setNavItems] = useState<Array<{ label: string; href: string; appearance?: string }>>(
    initial.nav_items
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  // === New: AI icon generator state ===
  const businessName = useMemo(() => (template as any)?.business_name || '', [template]);
  const industry = useMemo(() => template?.industry || '', [template]);
  const initials = useMemo(
    () => (businessName ? businessName.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 3).toUpperCase() : ''),
    [businessName]
  );

  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [useInitials, setUseInitials] = useState(false);
  const [style, setStyle] = useState<'flat' | 'badge' | 'monogram' | 'emblem'>('flat');
  const [accentHex, setAccentHex] = useState('#6D28D9'); // default purple
  const [transparentBG, setTransparentBG] = useState(true);

  const [faviconUrl, setFaviconUrl] = useState<string>((template as any)?.meta?.favicon_url || '');
  const [favBg, setFavBg] = useState<FavBg>('transparent'); // preview + generation background
  useEffect(() => {
    setFaviconUrl((template as any)?.meta?.favicon_url || '');
  }, [template]);

  const saving = Boolean(isSavingProp) || isSavingLocal;

  const areLinksValid =
    navItems.length === 0 || navItems.every((link) => link?.label?.trim?.() && link?.href?.trim?.());

  const handleFileUpload = async (file: File): Promise<string> => {
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    const toUpload = isSvg
      ? file
      : await imageCompression(file, {
          maxSizeMB: 5.0,
          maxWidthOrHeight: 500,
          useWebWorker: true,
        });

    const fileExt = (toUpload.name.split('.').pop() || 'png').toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error } = await supabase.storage.from('logos').upload(fileName, toUpload, {
      cacheControl: '3600',
      upsert: false,
      contentType: isSvg ? 'image/svg+xml' : undefined,
    });
    if (error) throw new Error(error.message || 'Upload failed');

    const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setIsUploading(true);
    try {
      const url = await handleFileUpload(acceptedFiles[0]);
      setLogoUrl(url);
      toast.success('Logo uploaded!');
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/png': [], 'image/jpeg': [], 'image/webp': [], 'image/svg+xml': [] },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
  });

  // === New: generate icon via AI ===
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

  // 🔹 Make favicon from current logo
  const makeFaviconFromLogoHere = async () => {
    try {
      const logo = (template as any)?.logo_url || logoUrl;
      if (!logo) { toast.error('Add a logo first'); return; }
      const logoBlob = await fetchAsBlob(logo);
      const ico32 = await downscaleToFavicon(logoBlob, favBg, accentHex);
      const url = await uploadFaviconViaAPI(template!.id as string, ico32);
      setFaviconUrl(url);
      window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: { meta: { favicon_url: url } } }));
      toast.success('Favicon updated');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Favicon from logo failed');
    }
  };

// AI 1024 → 32 → upload (uses favBg)
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
        transparent: true, // request transparent; we'll composite if desired
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || `Generate failed (${res.status})`);
    const b64 = json.image_base64 as string;
    const big = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });

    const ico32 = await downscaleToFavicon(big, favBg, accentHex);
    const url = await uploadFaviconViaAPI(template!.id as string, ico32);
    setFaviconUrl(url);
    window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: { meta: { favicon_url: url } } }));
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
                  <NextImage src={logoUrl} alt="Logo" width={100} height={100} className="h-16 w-auto object-contain" />                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoUrl('');
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

            {/* NEW: AI Icon Generator */}
            <div className="rounded-lg border border-white/10 p-3 bg-neutral-900/70">
              <div className="text-sm font-medium mb-2">AI Icon Generator</div>
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

                <Button
                  className="mt-2 w-full"
                  onClick={generateIcon}
                  disabled={genBusy}
                >
                  {genBusy ? 'Generating…' : 'Generate Icon'}
                </Button>

                {genError && (
                  <div className="mt-2 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300">
                    {genError}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={generateFaviconAIHere} disabled={genBusy}>
                {genBusy ? 'Generating…' : 'AI Favicon'}
              </Button>
              <Button size="sm" variant="outline" onClick={makeFaviconFromLogoHere} disabled={!logoUrl} className="bg-neutral-900">
                From Logo
              </Button>
              {/* Favicon preview + controls */}
              <div className="rounded-lg border border-white/10 p-3 bg-neutral-900/70">
                <FaviconUploader
                  templateId={template?.id as string}
                  currentUrl={faviconUrl}
                  onUpload={(url: string) => setFaviconUrl(url)}
                  bucket="favicons"
                  folder={`template-${template?.id as string}`}
                />

                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Favicon</div>
                  {faviconUrl ? <a href={faviconUrl} target="_blank" className="text-xs underline">Open</a> : null}
                </div>

                <div className="flex items-center gap-4">
                  {/* Preview squares with checker/white/black bg */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-8 h-8 rounded"
                        style={{
                          background:
                            favBg === 'transparent'
                              ? 'conic-gradient(#666 25%, transparent 0) 0 0/8px 8px, conic-gradient(#666 25%, transparent 0) 4px 4px/8px 8px, #fff'
                              : favBg === 'white'
                              ? '#fff'
                              : favBg === 'black'
                              ? '#000'
                              : '#6D28D9',
                        }}
                      >
                        {faviconUrl ? (
                          // 32 preview
                          <img src={faviconUrl} alt="favicon 32" className="w-8 h-8 object-contain mix-blend-normal" />
                        ) : null}
                      </div>
                      <span className="text-[10px] text-white/70">32px</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-4 h-4 rounded"
                        style={{
                          background:
                            favBg === 'transparent'
                              ? 'conic-gradient(#666 25%, transparent 0) 0 0/8px 8px, conic-gradient(#666 25%, transparent 0) 4px 4px/8px 8px, #fff'
                              : favBg === 'white'
                              ? '#fff'
                              : favBg === 'black'
                              ? '#000'
                              : '#6D28D9',
                        }}
                      >
                        {faviconUrl ? (
                          // visually scaled 16 preview
                          <img src={faviconUrl} alt="favicon 16" className="w-4 h-4 object-contain mix-blend-normal" />
                        ) : null}
                      </div>
                      <span className="text-[10px] text-white/70">16px</span>
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <label className="text-xs">Preview BG</label>
                    <select
                      className="rounded border border-white/10 bg-neutral-950 px-2 py-1 text-xs"
                      value={favBg}
                      onChange={e => setFavBg(e.target.value as FavBg)}
                    >
                      <option value="transparent">Checker</option>
                      <option value="accent">Accent</option>
                      <option value="white">White</option>
                      <option value="black">Black</option>
                    </select>
                  </div>
                </div>
              </div>
              {faviconUrl ? (
                <p className="mt-1 text-[10px] text-white/60 break-all">
                  {faviconUrl}
                </p>
              ) : <p className="mt-1 text-[10px] text-white/60">No favicon set</p>}
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
