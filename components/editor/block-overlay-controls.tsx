// components/editor/BlockOverlayControls.tsx
'use client';
import { Pencil, Trash2, GripVertical } from 'lucide-react';

export function BlockOverlayControls({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="absolute top-2 right-2 z-50 flex gap-2 bg-black/60 px-2 py-1 rounded shadow">
      <button onClick={onEdit} className="text-blue-300 hover:text-blue-400"><Pencil size={16} /></button>
      <button onClick={onDelete} className="text-red-400 hover:text-red-500"><Trash2 size={16} /></button>
      <div className="cursor-move text-gray-300"><GripVertical size={16} /></div>
    </div>
  );
}
