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
  errors = {},
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
    navItems.length === 0 || // allow empty; change to >0 if you want to require links
    navItems.every((link) => link?.label?.trim?.() && link?.href?.trim?.());

  const handleFileUpload = async (file: File): Promise<string> => {
    // SVGs shouldn’t be run through browser-image-compression
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
      // Always write canonical keys
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

  return (
    <div className="p-4 space-y-6 text-white bg-neutral-900 rounded-xl">
      <h3 className="text-lg font-semibold">Edit Page Header</h3>

      <div className="space-y-2">
        <Label className="text-white">Logo</Label>
        <div
          {...getRootProps()}
          className="border border-dashed rounded-md p-4 text-center cursor-pointer bg-neutral-900 min-h-[120px] flex items-center justify-center"
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="flex items-center gap-2 text-neutral-300">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Uploading...
            </div>
          ) : logoUrl ? (
            <div className="flex flex-col items-center gap-2">
              <Image src={logoUrl} alt="Logo" width={100} height={100} className="h-16 w-auto object-contain" />
              <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')}>
                Remove Logo
              </Button>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">
              Drag and drop a logo image here, or click to browse
              <br />
              (PNG, JPG, SVG, WebP — Max 5MB)
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-white">Navigation Links</Label>
        <QuickLinksEditor links={navItems} onChange={setNavItems} template={normalizedTemplate as Template} />
      </div>

      {!areLinksValid && (
        <div className="bg-red-900/40 text-red-300 border border-red-500 rounded p-3 text-sm">
          ⚠️ Please complete all required navigation links before saving.
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={saveBlock} disabled={saving || !areLinksValid}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
