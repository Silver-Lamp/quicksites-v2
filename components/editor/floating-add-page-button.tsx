// components/editor/FloatingAddPageButton.tsx
'use client';
import { Plus } from 'lucide-react';

export function FloatingAddPageButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 left-6 z-50 bg-green-600 hover:bg-green-700 text-white rounded-full p-3 shadow-lg"
      title="Add New Page"
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}
