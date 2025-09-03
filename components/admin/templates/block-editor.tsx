// components/admin/templates/block-editor.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import JsonFallbackEditor from './block-editors/json-fallback-editor';
import { BLOCK_EDITORS, type BlockEditorProps } from './block-editors';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { validateBlockRich } from '@/hooks/validateTemplateBlocks';
import type { Template } from '@/types/template';

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function preview(val: unknown, max = 140) {
  try {
    const s = typeof val === 'string' ? val : JSON.stringify(val);
    return s.length > max ? s.slice(0, max) + '…' : s;
  } catch {
    return String(val);
  }
}

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

  // 🔍 Recompute rich errors for this block whenever it changes
  const errors: BlockValidationError[] = useMemo(() => validateBlockRich(block as any), [block]);

  // Group by field for editor props (field → BlockValidationError[])
  const errorsByField: Record<string, BlockValidationError[]> = useMemo(() => {
    const grouped: Record<string, BlockValidationError[]> = {};
    for (const err of errors) {
      const key = err.field || '(root)';
      (grouped[key] ??= []).push(err);
    }
    return grouped;
  }, [errors]);

  // For quick summary lines (field → string[])
  const errorMessagesByField: Record<string, string[]> = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    for (const err of errors) {
      const key = err.field || '(root)';
      (grouped[key] ??= []).push(err.message);
    }
    return grouped;
  }, [errors]);

  const containerClass = classNames(
    'p-4 rounded space-y-4',
    colorMode === 'dark'
      ? 'bg-black text-white border border-black'
      : 'bg-white/5 border-white/10 text-black'
  );

  const jsonShellClass = classNames(
    colorMode === 'dark' ? 'dark:bg-neutral-900 dark:text-white' : 'bg-white/5 border-white/10 text-black'
  );

  const ErrorList = (
    <div className="p-2 bg-red-900/10 border border-red-700 rounded text-sm text-red-200">
      <strong>Validation issues:</strong>
      <ul className="list-disc list-inside mt-1 space-y-1">
        {errors.map((e, i) => (
          <li key={i}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-red-100">{e.message}</span>
              {e.field && (
                <code className="px-1.5 py-0.5 rounded bg-red-950/40 border border-red-800/50 text-[11px]">
                  {e.field}
                </code>
              )}
              {e.code && (
                <span className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/40 text-[11px]">
                  {e.code}
                </span>
              )}
            </div>
            {(e.expected !== undefined || e.received !== undefined || e.hint) && (
              <div className="ml-1 mt-0.5 text-[12px] text-zinc-200/90 space-y-0.5">
                {e.expected !== undefined && (
                  <div>
                    <span className="text-zinc-400">expected:</span>{' '}
                    <code className="text-zinc-200">{preview(e.expected)}</code>
                  </div>
                )}
                {e.received !== undefined && (
                  <div>
                    <span className="text-zinc-400">received:</span>{' '}
                    <code className="text-zinc-200">{preview(e.received)}</code>
                  </div>
                )}
                {e.hint && (
                  <div>
                    <span className="text-zinc-400">hint:</span> {e.hint}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  if (mode === 'json' || !hasEditor) {
    return (
      <div className={jsonShellClass}>
        {hasEditor && (
          <button
            className="mb-2 text-xs text-blue-400 underline"
            onClick={() => setMode('form')}
          >
            ← Back to Form Editor
          </button>
        )}

        {errors.length > 0 && (
          <div className="mb-3">{ErrorList}</div>
        )}

        <JsonFallbackEditor
          block={block}
          onSave={onSave}
          onClose={onClose}
          colorMode={colorMode as 'light' | 'dark'}
          template={template as unknown as Template}
        />

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
    <div className={containerClass}>
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
        <div className="mb-2">{ErrorList}</div>
      )}

      <LazyEditor
        template={template}
        block={block}
        onSave={onSave}
        onClose={onClose}
        // Pass rich grouped errors to child editors (field → BlockValidationError[])
        errors={errorsByField}
        // (Optional) if your editors currently expect message arrays, keep this name too:
        // errorsByFieldMessages={errorMessagesByField}
      />
    </div>
  );
}
