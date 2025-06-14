'use client';

import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogClose,
  DialogTitle,
} from '@/components/ui/dialog';
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
        {/* <DialogOverlay className="fixed inset-0 z-[9998] bg-background/80 backdrop-blur-none" /> */}
        <DialogOverlay className="fixed inset-0 z-[9998] bg-zinc-900 !opacity-100 transition-none" />
        <DialogContent
            // className="fixed right-0 top-0 h-screen w-full max-w-md z-[9999] bg-zinc-900 border-l border-zinc-700 shadow-xl overflow-y-auto"
            className=""
        >
            {title && (
                <DialogTitle className="text-lg font-semibold text-white mb-4">
                    {title}
                </DialogTitle>
            )}
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
