'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Page } from '@/types/template';
import BlockField from './block-editors/block-field';

type Props = {
  page: Page | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: Page) => void;
};

export default function PageSettingsModal({ page, open, onClose, onSave }: Props) {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (page) {
      setSlug(page.slug || '');
      setTitle(page.title || '');
      setMetaDescription(page.meta?.description || '');
      setVisible(page.meta?.visible !== false); // default true
    }
  }, [page]);

  if (!page) return null;

  const handleSave = () => {
    onSave({
      ...page,
      slug,
      meta: {
        ...(page.meta || {}),
        title,
        description: metaDescription,
        visible,
      },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white dark:bg-neutral-900 text-black dark:text-white">
        <h3 className="text-lg font-semibold mb-4">Page Settings</h3>

        <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="mb-3" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mb-3" />
        <Input
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          className="mb-3"
        />

        <BlockField
          type="boolean"
          label="Published"
          value={visible as unknown as string | number}
          onChange={(v: any) => setVisible(v)}
        />

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}