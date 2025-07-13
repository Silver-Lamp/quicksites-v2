// components/admin/templates/block-editor.tsx
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import JsonFallbackEditor from './block-editors/json-fallback-editor';
import { BLOCK_EDITORS, type BlockEditorProps } from './block-editors';

export default function BlockEditor({ block, onSave, onClose }: BlockEditorProps) {
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [hasEditor, setHasEditor] = useState<boolean>(block.type in BLOCK_EDITORS);

  useEffect(() => {
    setHasEditor(block.type in BLOCK_EDITORS);
  }, [block.type]);

  if (mode === 'json' || !hasEditor) {
    return (
      <div className="dark:bg-neutral-900 dark:text-white">
        {hasEditor && (
          <button
            className="mb-2 text-xs text-blue-400 underline"
            onClick={() => setMode('form')}
          >
            ← Back to Form Editor
          </button>
        )}
        <JsonFallbackEditor block={block} onSave={onSave} onClose={onClose} />
        {!hasEditor && (
          <div className="mt-4 p-2 bg-yellow-100 text-yellow-800 rounded text-sm dark:bg-yellow-900 dark:text-yellow-200">
            <p><strong>Heads up:</strong> No visual editor exists for type <code>{block.type}</code>. Using fallback JSON editor.</p>
          </div>
        )}
      </div>
    );
  }

  const LazyEditor = dynamic(BLOCK_EDITORS[block.type], {
    loading: () => <p className="text-sm italic text-gray-500 dark:text-gray-300">Loading editor...</p>,
    ssr: false,
  });

  return (
    <div className="dark:bg-neutral-900 dark:text-white">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold capitalize">{block.type} Editor</h3>
        <button
          onClick={() => setMode('json')}
          className="text-xs text-blue-400 underline"
        >
          Switch to JSON
        </button>
      </div>
      <LazyEditor block={block} onSave={onSave} onClose={onClose} />
    </div>
  );
}
