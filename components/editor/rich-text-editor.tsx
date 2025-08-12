// components/editor/rich-text-editor.tsx
'use client';

import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

export type RichTextValue = {
  format?: 'tiptap' | 'html';
  json?: any;
  html?: string;
};

export default function RichTextEditor({
  value,
  onChange,
  onSave, // NEW: used when Shift+Enter is pressed
  placeholder = 'Write something great…',
  onUploadImage,
}: {
  value: RichTextValue;
  onChange: (next: RichTextValue & { word_count?: number }) => void;
  onSave?: () => void;
  placeholder?: string;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  // Build + de‑dupe extensions to avoid duplicate name warnings
  const builtExtensions = useMemo(() => ([
    StarterKit,
    Underline,
    Typography,
    TaskList,
    TaskItem,
    CharacterCount.configure({ limit: 0 }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
    Image.configure({ inline: false }),
    Placeholder.configure({ placeholder }),
  ]), [placeholder]);

  const extensions = useMemo(() => {
    const seen = new Set<string>();
    return builtExtensions.filter((ext: any) => {
      const name = ext?.name ?? ext?.config?.name;
      if (!name) return true;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [builtExtensions]);

  const editor = useEditor({
    extensions,
    immediatelyRender: false, // SSR‑safe
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: [
          'prose prose-slate dark:prose-invert',
          'max-w-none min-h-[240px] rounded-xl outline-none',
          'bg-white text-zinc-900',
          'dark:bg-zinc-900 dark:text-zinc-100',
          'leading-relaxed text-[15px]'
        ].join(' '),
      },
      // ⬇️ Keyboard behavior overrides
      handleKeyDown: (_view, event) => {
        // SHIFT+ENTER → Save
        if (event.key === 'Enter' && event.shiftKey) {
          event.preventDefault();
          onSave?.();
          return true;
        }
        // ENTER → single line break (hardBreak)
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          // Use hard break so it looks like 1 line (no paragraph margins)
          editor?.chain().focus().setHardBreak().run();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const html = editor.getHTML();
      const text = editor.getText();
      const word_count = text.trim() ? text.trim().split(/\s+/).length : 0;
      onChange({ format: 'tiptap', json, html, word_count });
    },
  });

  // Seed content after mount to avoid hydration mismatch
  useEffect(() => {
    if (!editor) return;
    if (value?.json) editor.commands.setContent(value.json, { parseOptions: { preserveWhitespace: 'full' } });
    else if (value?.html) editor.commands.setContent(value.html, { parseOptions: { preserveWhitespace: 'full' } });
  }, [editor, value?.json, value?.html]);

  if (!editor) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{(editor.storage.characterCount as any).words?.() ?? ''} words</span>
        <span>{(editor.storage.characterCount as any).characters?.() ?? ''} chars</span>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const Btn = (props: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        'px-2 py-1 rounded-md text-sm transition',
        'hover:bg-zinc-100 text-zinc-700',
        'dark:hover:bg-zinc-800 dark:text-zinc-200',
        props.active ? 'bg-zinc-200 dark:bg-zinc-700' : '',
      ].join(' ')}
    >
      {props.children}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1 border-b border-zinc-200 px-2 py-2 dark:border-zinc-800">
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>B</Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>I</Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>S</Btn>
      <Btn onClick={() => editor.chain().focus().setParagraph().run()}>P</Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</Btn>
      <Btn onClick={() => editor.chain().focus().undo().run()}>↶</Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()}>↷</Btn>
      <Btn onClick={() => { const url = window.prompt('Image URL'); if (url) editor.chain().focus().setImage({ src: url }).run(); }}>🖼</Btn>
      <Btn onClick={() => { const url = window.prompt('Add link'); if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run(); }}>🔗</Btn>
      <Btn onClick={() => editor.chain().focus().unsetLink().run()}>⛓</Btn>
      <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>Clear</Btn>
    </div>
  );
}