// components/editor/dynamic-block-editor.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { createBrowserClient } from '@supabase/ssr';

import { BLOCK_EDITORS } from '@/components/admin/templates/block-editors';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import type { Block } from '@/types/blocks';
import { InlineBlockTypePicker } from './inline-block-type-picker';
import RichTextEditor from '@/components/editor/rich-text-editor';

// --- config ---
const TIMEOUT_MS = 6000; // “a few seconds” — tweak to taste

// Inline upload helper so we don't depend on '@/lib/supabase/browser'
async function uploadEditorImage(file: File, folder = 'editor-images') {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const path = `${folder}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage
    .from('templates')
    .upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from('templates').getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}

export function DynamicBlockEditor({
  block,
  onSave,
  onClose,
  errors,
  template,
  colorMode,
}: BlockEditorProps & { colorMode?: 'light' | 'dark' }) {
  const [EditorComponent, setEditorComponent] =
    useState<React.FC<BlockEditorProps> | null>(null);

  const [showTypePicker, setShowTypePicker] = useState(!block?.type);

  // timeout + retry + error state
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<null | { kind: 'timeout' | 'error'; err?: any }>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Kick off lazy load of the block editor (except for text, which is inline)
  useEffect(() => {
    let cancelled = false;

    // Reset states whenever block type or retryNonce changes
    setEditorComponent(null);
    setLoadError(null);

    if (!block?.type || block.type === 'text') {
      // handled below with inline RichTextEditor; no dynamic import
      setLoading(false);
      return;
    }

    // no registered editor
    if (!BLOCK_EDITORS[block.type]) {
      setLoading(false);
      setLoadError({ kind: 'error', err: new Error(`No editor registered for "${block.type}"`) });
      return;
    }

    setLoading(true);

    // Setup timeout
    timerRef.current = window.setTimeout(() => {
      if (!cancelled) {
        setLoadError({ kind: 'timeout' });
        setLoading(false);
      }
    }, TIMEOUT_MS) as unknown as number;

    // Try to load the editor module
    BLOCK_EDITORS[block.type]!()
      .then((mod) => {
        if (cancelled) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        setEditorComponent(() => mod.default);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        setLoadError({ kind: 'error', err });
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.type, retryNonce]);

  if (showTypePicker) {
    return (
      <div className="p-4">
        <InlineBlockTypePicker
          onSelect={(type) => {
            block.type = type as Block['type'];
            if (block.type === 'text') {
              block.content = {
                format: 'tiptap',
                html: '',
                json: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
                summary: '',
                word_count: 0,
              };
            }
            setShowTypePicker(false);
          }}
        />
      </div>
    );
  }

  // Special case for `text` block → use RichTextEditor directly (always available)
  if (block.type === 'text') {
    if (!block.content) {
      block.content = {
        format: 'tiptap',
        html: '',
        json: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
        summary: '',
        word_count: 0,
      } as any;
    }
    return (
        <div className={['p-4', colorMode === 'dark' ? 'dark' : ''].join(' ')}>
        <div className={['bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 rounded-lg', colorMode === 'dark' ? 'dark' : ''].join(' ')}>
          <RichTextEditor
          value={{
            format: block.content?.format,
            json: block.content?.json,
            html: block.content?.html ?? block.content?.value ?? '',
          }}
          onChange={(next) => {
            const safeHtml = next.html ? DOMPurify.sanitize(next.html) : '';
            block.content = {
              ...block.content,
              format: 'tiptap',
              json: next.json ?? { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
              html: safeHtml,
              summary: (safeHtml || '').replace(/<[^>]+>/g, '').slice(0, 280),
              word_count: next.word_count ?? 0,
            };
          }}
          onUploadImage={async (file) => {
            const { publicUrl } = await uploadEditorImage(file, 'editor-images');
            return publicUrl;
          }}
          onSave={() => onSave(block)}
          placeholder="Type ‘/’ for commands…"
        />
      </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => onSave(block)}
            className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/80"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // --- Timeout / Error fallback UI ---
  if (!EditorComponent) {
    if (loading && !loadError) {
      return (
        <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2" role="status" aria-live="polite">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-zinc-400" />
          Loading editor for <code>{block.type}</code> block…
        </div>
      );
    }

    // Either timed out or failed to import
    return (
      <div className="p-4">
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 text-yellow-100 p-3 text-sm">
          {loadError?.kind === 'timeout'
            ? <>The <code>{block.type}</code> editor is taking too long to load.</>
            : <>Couldn’t load the <code>{block.type}</code> editor.</>}
        </div>

        {/* JSON fallback editor */}
        <details className="mt-3 rounded-md border border-zinc-700 bg-zinc-900 p-3">
          <summary className="cursor-pointer text-sm text-zinc-200">Open minimal JSON editor</summary>
          <JsonFallbackEditor
            initialValue={block.content}
            onCancel={onClose}
            onApply={(next) => {
              block.content = next as any;
              onSave(block);
            }}
          />
        </details>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setRetryNonce((n) => n + 1)}
            className="px-3 py-1.5 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-500"
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Happy path: loaded specialized editor
  return (
    <EditorComponent
      block={block}
      onSave={onSave}
      onClose={onClose}
      errors={errors}
      template={template}
    />
  );
}

// --- tiny JSON fallback editor ---
function JsonFallbackEditor({
  initialValue,
  onApply,
  onCancel,
}: {
  initialValue: unknown;
  onApply: (val: unknown) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(initialValue ?? {}, null, 2));
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mt-2">
      <textarea
        className="w-full h-48 rounded-md border border-zinc-700 bg-black/40 p-2 font-mono text-xs text-zinc-100"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      {err && <div className="mt-1 text-xs text-red-400">{err}</div>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => {
            try {
              const parsed = JSON.parse(text || '{}');
              setErr(null);
              onApply(parsed);
            } catch (e: any) {
              setErr(e?.message || 'Invalid JSON');
            }
          }}
          className="px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-500"
        >
          Apply
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
