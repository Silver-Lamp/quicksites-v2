'use client';

import { useEffect, useState } from 'react';
import type { Block } from '@/types/blocks';

type Props = {
  block: Block;
  onSave: (block: Block) => void;
  onClose: () => void;
};

export default function JsonFallbackEditor({ block, onSave, onClose }: Props) {
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(JSON.stringify(block, null, 2));
    setError(null);
  }, [block]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(value);
      onSave(parsed);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Invalid JSON');
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        className="w-full h-80 p-2 text-sm font-mono bg-neutral-800 text-white border border-gray-700 rounded"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">
          Save
        </button>
      </div>
    </div>
  );
}
