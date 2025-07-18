// components/editor/GridDragHandle.tsx
'use client';
import { GripVertical } from 'lucide-react';

export function GridDragHandle({ className = '' }: { className?: string }) {
  return (
    <div
      className={`cursor-move text-gray-400 hover:text-white transition ${className}`}
      title="Drag to move"
    >
      <GripVertical className="w-4 h-4" />
    </div>
  );
}
