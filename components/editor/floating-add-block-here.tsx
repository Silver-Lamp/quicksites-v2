// components/editor/FloatingAddBlockHere.tsx
'use client';
import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { InlineBlockTypePicker } from './inline-block-type-picker';
import type { Block } from '@/types/blocks';

export function FloatingAddBlockHere({ onAdd }: { onAdd: (type: Block['type']) => void }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker((prev) => !prev)}
        className="w-full flex justify-center py-2 hover:bg-purple-900/10 text-purple-400 hover:text-white transition text-sm"
        title="Add Block Here"
      >
        <PlusCircle className="w-5 h-5 mr-1" />
        Add Block
      </button>

      {showPicker && (
        <div className="absolute z-50 mt-2 w-64 bg-neutral-900 border border-white/10 rounded shadow-lg">
          <InlineBlockTypePicker
            onSelect={(type) => {
              onAdd(type as Block['type']);
              setShowPicker(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
