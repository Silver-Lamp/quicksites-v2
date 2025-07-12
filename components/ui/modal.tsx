'use client';

import { useEffect, useRef, createContext, useId, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ModalContext = createContext<{ labelId: string } | null>(null);

export function Modal({
  show,
  onClose,
  title,
  children,
}: {
  show: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const labelId = useId(); // Unique for aria-labelledby

  // ESC key to close
  useEffect(() => {
    if (!show) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [show, onClose]);

  // Focus trap
  useEffect(() => {
    if (!show || !modalRef.current) return;

    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (focusable.length === 0) return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <ModalContext.Provider value={{ labelId }}>
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />

            {/* Modal container */}
            <motion.div
              ref={modalRef}
              className="relative z-10 bg-white text-black dark:bg-zinc-900 dark:text-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelId}
              tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="overflow-y-auto p-6 flex-1">
                {title && (
                  <h2 id={labelId} className="text-lg font-semibold mb-4">
                    {title}
                  </h2>
                )}
                {children}
              </div>

              <div className="border-t bg-white/10 px-6 py-4 flex justify-end gap-2 sticky bottom-0 z-10">
                <button
                  onClick={onClose}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        </ModalContext.Provider>
      )}
    </AnimatePresence>
  );
}

// Optional: named slot for custom title (when using children only)
export function ModalTitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(ModalContext);
  if (!ctx) return null;

  return (
    <h2 id={ctx.labelId} className={`text-lg font-semibold mb-4 ${className}`}>
      {children}
    </h2>
  );
}
