'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

export default function OGPreviewModal({ open, onOpenChange, ogImageUrl }: {
  open: boolean;
  onOpenChange: (val: boolean) => void;
  ogImageUrl: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>OG Image Preview</DialogTitle>
        </DialogHeader>
        {ogImageUrl ? (
          <div className="w-full h-auto">
            <Image
              src={ogImageUrl}
              alt="OG Image Preview"
              width={1200}
              height={630}
              className="rounded-lg border border-gray-800 shadow"
            />
          </div>
        ) : (
          <p className="text-muted-foreground">No OG image available.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
