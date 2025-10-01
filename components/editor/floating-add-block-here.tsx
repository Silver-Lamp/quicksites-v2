// components/editor/floating-add-block-here.tsx
'use client';
import { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';
import type { Block } from '@/types/blocks';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { Template } from '@/types/template';

export function FloatingAddBlockHere({ onAdd, template }: { onAdd: (type: Block['type']) => void, template: Template }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative">
      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          className="w-full flex justify-center py-2 hover:bg-purple-900/10 text-purple-400 hover:text-white transition text-sm"
          title="Add Block Here"
        >
          <PlusCircle className="w-5 h-5 mr-1" />
          Add Blockzzz
        </button>
      ) : (
        <div className="absolute z-50 mt-2 w-full max-w-md">
          <div className="relative bg-neutral-900 border border-white/10 rounded shadow-lg p-2">
            <div className="absolute top-2 right-2">
              <button
                onClick={() => setShowPicker(false)}
                className="text-white hover:text-red-400"
                title="Close block picker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* <BlockAdderGrouped
              label="Pick a block"
              existingBlocks={[]} // can pass actual blocks here if needed for duplicate filtering
              onAdd={(type) => {
                onAdd(type as Block['type']);
                setShowPicker(false);
              }}
            /> */}
            <BlockAdderGrouped
              onClose={()=>{}}
              existingBlocks={[]}
              onAdd={(type) => onAdd(type as Block['type'])}
              template={template as Template}
            />

          </div>
        </div>
      )}    
    </div>
  );
}
