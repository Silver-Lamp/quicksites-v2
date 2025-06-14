'use client';

import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogClose,
} from '@/components/ui/dialog';
import { ReactNode } from 'react';

type ModalWrapperProps = {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
};

export default function ModalWrapper({ children, onClose, open }: ModalWrapperProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogOverlay className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogContent className="z-[9999] bg-zinc-900 p-6 rounded-lg w-full max-w-3xl relative shadow-xl border border-zinc-700 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
        <DialogClose
          className="absolute top-3 right-4 text-white text-2xl hover:text-red-400"
          aria-label="Close modal"
        >
          ✖
        </DialogClose>
        {children}
      </DialogContent>
    </Dialog>
  );
}
