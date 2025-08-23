'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import JsonFallbackEditor from './block-editors/json-fallback-editor';
import { BLOCK_EDITORS, type BlockEditorProps } from './block-editors';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { Template } from '@/types/template';

export default function BlockEditor({
  block,
  onSave,
  onClose,
  template,
  colorMode = 'dark',
}: BlockEditorProps & { colorMode?: 'light' | 'dark' }) {
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [hasEditor, setHasEditor] = useState<boolean>(block.type in BLOCK_EDITORS);

  useEffect(() => {
    setHasEditor(block.type in BLOCK_EDITORS);
  }, [block.type]);

  const errors: BlockValidationError[] = (block as any)._meta?.errorMessages || [];

  const errorsByField = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    for (const err of errors) {
      if (!grouped[err.field]) grouped[err.field] = [];
      grouped[err.field].push(err.message);
    }
    return grouped;
  }, [errors]);

  if (mode === 'json' || !hasEditor) {
    return (
      <div className={`${colorMode === 'dark' ? 'dark:bg-neutral-900 dark:text-white' : 'bg-white/5 border-white/10 text-black'}`}>
        {hasEditor && (
          <button
            className="mb-2 text-xs text-blue-400 underline"
            onClick={() => setMode('form')}
          >
            ← Back to Form Editor
          </button>
        )}

        {errors.length > 0 && (
          <div className="mb-3 p-2 bg-red-900/20 text-red-200 text-sm rounded border border-red-700">
            <strong>Validation issues:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              {errors.map((err, i) => (
                <li key={i}>
                  <code>{err.field}</code>: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <JsonFallbackEditor block={block} onSave={onSave} onClose={onClose} colorMode={colorMode as 'light' | 'dark'} template={template as unknown as Template} />

        {!hasEditor && (
          <div className="mt-4 p-2 bg-yellow-100 text-yellow-800 rounded text-sm dark:bg-yellow-900 dark:text-yellow-200">
            <p>
              <strong>Note:</strong> No visual editor exists for type <code>{block.type}</code>. Using JSON fallback.
            </p>
          </div>
        )}
      </div>
    );
  }

  const LazyEditor = dynamic(BLOCK_EDITORS[block.type], {
    ssr: false,
    loading: () => <p>Loading editor...</p>,
  });

  return (
    <div className={`space-y-4 ${colorMode === 'dark' ? 'bg-black text-white border border-black' : 'bg-white/5 border-white/10 text-black'} p-4 rounded`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold capitalize">{block.type} Editor</h3>
        <button
          onClick={() => setMode('json')}
          className="text-xs text-blue-400 underline"
        >
          Switch to JSON
        </button>
      </div>

      {errors.length > 0 && (
        <div className="p-2 bg-red-900/10 border border-red-700 rounded text-sm text-red-200">
          <strong>Validation issues:</strong>
          <ul className="list-disc list-inside mt-1">
            {Object.entries(errorsByField).map(([field, messages]) => (
              <li key={field}>
                <code>{field}</code>: {messages.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <LazyEditor
        template={template}
        block={block}
        onSave={onSave}
        onClose={onClose}
        errors={errorsByField as unknown as Record<string, BlockValidationError[]>}
      />
    </div>
  );
}
