'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { Block, PageHeaderBlock } from '@/types/blocks';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { Template } from '@/types/template';
import QuickLinksEditor from '@/components/admin/fields/quick-links-editor';

type Props = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
  errors?: Record<string, BlockValidationError[]>;
  template?: Template;
  isSaving?: boolean;
};

export default function PageHeaderEditor({ block, onSave, onClose, errors = {}, template }: Props) {
  if (block.type !== 'page_header') {
    return <div className="text-red-500">Invalid block type</div>;
  }

  const headerBlock = block as PageHeaderBlock;
  const [logoUrl, setLogoUrl] = useState(headerBlock.content.logoUrl || template?.logo_url || '');
  const [navItems, setNavItems] = useState([...headerBlock.content.navItems]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const areLinksValid = navItems.every((link) => link.label.trim() && link.href.trim());

  const handleFileUpload = async (file: File): Promise<string> => {
    const compressed = await imageCompression(file, {
      maxSizeMB: 5.0,
      maxWidthOrHeight: 500,
      useWebWorker: true,
    });

    const fileExt = compressed.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error } = await supabase.storage
      .from('logos')
      .upload(filePath, compressed, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw new Error('Upload failed');

    const {
      data: { publicUrl },
    } = supabase.storage.from('logos').getPublicUrl(filePath);
    console.log('publicUrl', publicUrl);
    return publicUrl;
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setIsUploading(true);
    try {
      const url = await handleFileUpload(acceptedFiles[0]);
      setLogoUrl(url);
      toast.success('Logo uploaded!');
    } catch (err) {
      toast.error('Upload failed');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/png': [], 'image/jpeg': [], 'image/webp': [], 'image/svg+xml': [] },
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const saveBlock = () => {
    setIsSaving(true);
    onSave({
      ...block,
      content: {
        logoUrl,
        navItems,
      },
    });
    onClose();
    setIsSaving(false);
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
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
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
              Drag and drop a logo image here, or click to browse<br />
              (PNG, JPG, SVG, WebP — Max 5MB)
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-white">Navigation Links</Label>
        <QuickLinksEditor links={navItems} onChange={setNavItems} template={template || ({} as Template)} />
      </div>

      {!areLinksValid && (
        <div className="bg-red-900/40 text-red-300 border border-red-500 rounded p-3 text-sm">
          ⚠️ Please complete all required navigation links before saving.
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={saveBlock} disabled={isSaving || !areLinksValid}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
