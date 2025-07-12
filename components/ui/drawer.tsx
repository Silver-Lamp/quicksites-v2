import { ReactNode } from 'react';

export function Drawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="w-full sm:w-[420px] bg-black/90 p-4 overflow-y-auto">
        <button
          onClick={onClose}
          className="text-sm text-white mb-4 hover:underline"
        >
          ← Close
        </button>
        {children}
      </div>
      <div
        className="flex-1 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
    </div>
  );
}
