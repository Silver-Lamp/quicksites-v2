// components/editor/InlineBlockTypePicker.tsx
'use client';
import { useState } from 'react';
import { PlusCircle } from 'lucide-react';

const BLOCK_TYPES = ['hero', 'testimonial', 'services', 'cta', 'image', 'text'];

export function InlineBlockTypePicker({ onSelect }: { onSelect: (type: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-full text-left text-sm text-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-3 py-1 border border-purple-500 rounded hover:bg-purple-700 bg-purple-600"
      >
        <PlusCircle size={16} /> Add Blockz
      </button>
      {open && (
        <div className="absolute mt-1 bg-black border border-white/10 rounded shadow-lg z-10 w-48">
          {BLOCK_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => {
                onSelect(type);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-white/10"
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
