'use client';

import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogClose,
  DialogTitle,
} from '@/components/ui';
import { ReactNode } from 'react';

type ModalWrapperProps = {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title?: string;
};

export default function ModalWrapper({ children, onClose, open, title }: ModalWrapperProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      {/* Backdrop */}
      <DialogOverlay className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm dark:bg-black/60" />

      {/* Modal content */}
      <DialogContent
        className="z-[9999] max-w-xl border border-neutral-700 rounded-lg shadow-xl p-0 overflow-y-auto bg-transparent"
      >
        <div className="p-6 bg-white text-black dark:bg-neutral-900 dark:text-white rounded-lg">
          {/* Title */}
          {title && (
            <DialogTitle className="text-lg font-semibold mb-4">
              {title}
            </DialogTitle>
          )}

          {/* Close button */}
          <DialogClose
            className="absolute top-3 right-4 text-black dark:text-white text-2xl hover:text-red-400"
            aria-label="Close modal"
          >
            ✖
          </DialogClose>

          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
