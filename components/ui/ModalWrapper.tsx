'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FocusTrap from 'focus-trap-react';
import { ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';

type ModalWrapperProps = {
  children: ReactNode;
  onClose: () => void;
  id?: string; // optional for queueing/stacking logic
};

export default function ModalWrapper({ children, onClose, id }: ModalWrapperProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Mount modal into portal
  useEffect(() => {
    setMounted(true);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Escape key support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleClickOutside = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const modalContent = (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        onClick={handleClickOutside}
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        key={id || 'modal'}
      >
        <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
          <motion.div
            className="bg-zinc-900 p-6 rounded-lg w-full max-w-3xl relative shadow-xl border border-zinc-700 focus:outline-none"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-4 text-white text-2xl hover:text-red-400"
              aria-label="Close modal"
            >
              ✖
            </button>
            {children}
          </motion.div>
        </FocusTrap>
      </motion.div>
    </AnimatePresence>
  );

  return mounted ? createPortal(modalContent, document.body) : null;
}
