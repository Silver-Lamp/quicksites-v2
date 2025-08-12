// components/editor/dynamic-block-editor.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { createBrowserClient } from '@supabase/ssr';

import { BLOCK_EDITORS } from '@/components/admin/templates/block-editors';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import type { Block } from '@/types/blocks';
import { InlineBlockTypePicker } from './inline-block-type-picker';
import RichTextEditor from '@/components/editor/rich-text-editor';

// Inline upload helper so we don't depend on '@/lib/supabase/browser'
async function uploadEditorImage(file: File, folder = 'editor-images') {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const path = `${folder}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage
    .from('templates')
    .upload(path, file, {
      upsert: false,
      cacheControl: '3600',
      contentType: file.type,
    });

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
}: BlockEditorProps) {
  const [EditorComponent, setEditorComponent] = useState<React.FC<BlockEditorProps> | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(!block?.type);

  useEffect(() => {
    const load = async () => {
      if (block?.type && BLOCK_EDITORS[block.type]) {
        const mod = await BLOCK_EDITORS[block.type]!();
        setEditorComponent(() => mod.default);
      }
    };
    load();
  }, [block]);

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
                json: {
                  type: 'doc',
                  content: [{ type: 'paragraph', content: [] }],
                },
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

  // Special case for `text` block → use RichTextEditor directly
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
      <div className="p-4 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
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
              json: next.json ?? {
                type: 'doc',
                content: [{ type: 'paragraph', content: [] }],
              },
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

  if (!EditorComponent) {
    return (
      <div className="text-sm text-muted-foreground px-4 py-3">
        Loading editor for <code>{block.type}</code> block...
      </div>
    );
  }

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
