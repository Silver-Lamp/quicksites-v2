'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { Block, PageHeaderBlock } from '@/types/blocks';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { Template } from '@/types/template';

type Props = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
  errors: BlockValidationError[];
  template: Template;
};

export default function PageHeaderEditor({ block, onSave, onClose, errors = [], template }: Props) {
  if (block.type !== 'page_header') {
    return <div className="text-red-500">Invalid block type</div>;
  }

  const headerBlock = block as PageHeaderBlock;
  const [logoUrl, setLogoUrl] = useState(headerBlock.content.logoUrl || template.logo_url || '');
  const [navItems, setNavItems] = useState([...headerBlock.content.navItems]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateNavItem = (index: number, field: 'label' | 'href', value: string) => {
    const updated = [...navItems];
    updated[index] = { ...updated[index], [field]: value };
    setNavItems(updated);
  };

  const removeNavItem = (index: number) => {
    const updated = [...navItems];
    updated.splice(index, 1);
    setNavItems(updated);
  };

  const addNavItem = () => {
    setNavItems([...navItems, { label: '', href: '' }]);
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 500,
      useWebWorker: true,
    });

    const fileExt = compressed.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    const { error } = await supabase.storage
      .from('public')
      .upload(filePath, compressed, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw new Error('Upload failed');

    const {
      data: { publicUrl },
    } = supabase.storage.from('public').getPublicUrl(filePath);

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
    maxSize: 1 * 1024 * 1024,
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
              (PNG, JPG, SVG, WebP — Max 1MB)
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-white">Navigation Links</Label>
        {navItems.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <Input className="flex-1" value={item.label} onChange={(e) => updateNavItem(idx, 'label', e.target.value)} placeholder="Label" />
            <Input className="flex-1" value={item.href} onChange={(e) => updateNavItem(idx, 'href', e.target.value)} placeholder="/link" />
            <Button variant="ghost" onClick={() => removeNavItem(idx)} size="icon">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        <Button type="button" variant="secondary" onClick={addNavItem}>
          <Plus className="w-4 h-4 mr-1" /> Add Link
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="text-red-500">
          {errors.map((error, index) => (
            <p key={index}>{error.message}</p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={saveBlock} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
