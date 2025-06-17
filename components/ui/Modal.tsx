'use client';
import { motion } from 'framer-motion';

export function Modal({
  show,
  onClose,
  children,
}: {
  show: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-surface text-text rounded-md p-6 max-w-md w-full shadow-lg"
      >
        {children}
        <button
          onClick={onClose}
          className="mt-4 text-sm text-accent hover:underline"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}
