// components/admin/templates/block-editors/header-editor.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
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

    const fileExt = (toUpload.name.split('.').pop() || 'jpg').toLowerCase();
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

  return (
    <div className="relative flex max-h-[calc(100vh-8rem)] min-h-0 flex-col text-white">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-neutral-900/70 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Edit Page Header</h3>
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
        {/* ⬇️ 1/3 (logo) | 2/3 (links) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-6">
          {/* LEFT: Logo = 1/3 */}
          <section className="lg:col-span-1 max-w-full space-y-2">
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
                  <Image src={logoUrl} alt="Logo" width={100} height={100} className="h-16 w-auto object-contain" />
                  <Button
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
          </section>

          {/* RIGHT: Links = 2/3 */}
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
