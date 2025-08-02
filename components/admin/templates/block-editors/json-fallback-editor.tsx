'use client';

import { useEffect, useState } from 'react';
import type { BlockEditorProps } from './index'; // ✅ Reuse the shared type
import { extractFieldErrors } from '../utils/extractFieldErrors';
import type { Block } from '@/types/blocks';
  
export default function JsonFallbackEditor({ block, onSave, onClose, errors = {}, template, colorMode = 'dark' }: BlockEditorProps & { colorMode?: 'light' | 'dark' }) {
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]); // now accepts Record<string, BlockValidationError[]>
  useEffect(() => {
    setValue(JSON.stringify(block, null, 2));
    setError(null);
  }, [block]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(value);
      onSave(parsed as unknown as Block);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Invalid JSON');
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        className={`w-full h-80 p-2 text-sm font-mono ${colorMode === 'dark' ? 'bg-neutral-800 text-white border border-gray-700' : 'bg-white/5 border-white/10 text-black'} rounded`}
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
