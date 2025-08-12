// components/editor/rich-text-editor.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
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

// Build classes without depending on "dark:" inheritance
function buildEditorClass(tight: boolean, isDark: boolean) {
    const base = [
      'prose prose-slate',
      'max-w-none min-h-[240px]',
      // no inner rounding/borders; also kill any focus outline/ring entirely
      'rounded-none border-0 ring-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
      isDark ? 'bg-neutral-900 text-neutral-100' : 'bg-white text-zinc-900',
      'px-4 py-3',
      'leading-relaxed text-[15px]',
    ];
    const comfy = [
      'prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-blockquote:my-4',
      'prose-headings:my-3 prose-h2:mt-4 prose-h2:mb-2 prose-h3:my-2',
    ];
    const compact = [
      'prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-2',
      'prose-headings:my-2 prose-h2:mt-3 prose-h2:mb-1 prose-h3:my-1',
    ];
    if (isDark) base.push('prose-invert');
    return [...base, ...(tight ? compact : comfy)].join(' ');
  }
  

export default function RichTextEditor({
  value,
  onChange,
  onSave,           // Shift+Enter
  onCancel,         // Esc
  placeholder = '',
  onUploadImage,
  colorMode,        // 'dark' by default
}: {
  value: RichTextValue;
  onChange: (next: RichTextValue & { word_count?: number }) => void;
  onSave?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  onUploadImage?: (file: File) => Promise<string>;
  colorMode?: 'light' | 'dark';
}) {
  // Tight spacing toggle with persistence
  const [tightSpacing, setTightSpacing] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('qs_rte_tight');
    return saved ? saved === '1' : false;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('qs_rte_tight', tightSpacing ? '1' : '0');
    }
  }, [tightSpacing]);

  // Default to dark if nothing is provided
  const isDark = (colorMode ?? 'dark') === 'dark';

  const builtExtensions = useMemo(
    () => [
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
    ],
    [placeholder]
  );

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
    immediatelyRender: false,
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: buildEditorClass(tightSpacing, isDark),
      },
      handleKeyDown: (_view, event) => {
        // Ignore while composing (IME)
        // // @ts-expect-error
        if ((event as any).isComposing) return false;

        if (event.key === 'Escape') {
          if (onCancel) {
            event.preventDefault();
            onCancel();
            return true;
          }
          return false;
        }

        if (event.key === 'Enter' && event.shiftKey) {
          event.preventDefault();
          onSave?.();
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

  // Reflect spacing changes live
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...(editor.options.editorProps?.attributes ?? {}),
          class: buildEditorClass(tightSpacing, isDark),
        },
      },
    });
  }, [editor, tightSpacing, isDark]);

  // Seed content
  useEffect(() => {
    if (!editor) return;
    if (value?.json)
      editor.commands.setContent(value.json, { parseOptions: { preserveWhitespace: 'full' } });
    else if (value?.html)
      editor.commands.setContent(value.html, { parseOptions: { preserveWhitespace: 'full' } });
  }, [editor, value?.json, value?.html]);

  if (!editor) return null;

  return (
    <div
    className={[
        'rounded-2xl border overflow-hidden shadow-sm',
        isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-zinc-200',
    ].join(' ')}
    >
      <Toolbar
        editor={editor}
        tightSpacing={tightSpacing}
        onToggleTight={() => setTightSpacing((t) => !t)}
        isDark={isDark}
      />
    <div className={isDark ? 'bg-neutral-900' : 'bg-white'}>
        <EditorContent editor={editor} />
    </div>
      <div
        className={[
            'flex items-center justify-between px-3 py-2 text-xs',
            isDark ? 'text-neutral-400 bg-neutral-900' : 'text-zinc-500 bg-white',
        ].join(' ')}
        >
        <span>{(editor.storage.characterCount as any).words?.() ?? ''} words</span>
        <span>{(editor.storage.characterCount as any).characters?.() ?? ''} chars</span>
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  tightSpacing,
  onToggleTight,
  isDark,
}: {
  editor: Editor;
  tightSpacing: boolean;
  onToggleTight: () => void;
  isDark: boolean;
}) {
  const Btn = (props: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      className={[
        'px-2 py-1 rounded-md text-sm transition',
        props.active
          ? isDark
            ? 'bg-neutral-700 text-neutral-200'
            : 'bg-zinc-200 text-zinc-700'
          : isDark
          ? 'text-neutral-200 hover:bg-neutral-800'
          : 'text-zinc-700 hover:bg-zinc-100',
      ].join(' ')}
    >
      {props.children}
    </button>
  );

  return (
    <div
    className={[
        'flex flex-wrap gap-1 px-2 py-2 border-b',
        isDark ? 'border-neutral-800 bg-neutral-900' : 'border-zinc-200 bg-white',
    ].join(' ')}
    >
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">B</Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">I</Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">U</Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strike">S</Btn>
      <Btn onClick={() => editor.chain().focus().setParagraph().run()} title="Paragraph">P</Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">H2</Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">H3</Btn>
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bulleted list">• List</Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered list">1. List</Btn>
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">❝</Btn>
      <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo">↶</Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo">↷</Btn>
      <Btn
        onClick={() => {
          const url = window.prompt('Image URL');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
        title="Insert image"
      >
        🖼
      </Btn>
      <Btn
        onClick={() => {
          const url = window.prompt('Add link');
          if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }}
        title="Add link"
      >
        🔗
      </Btn>
      <Btn onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">⛓</Btn>
      <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">Clear</Btn>

      <span className={['mx-1 w-px self-stretch', isDark ? 'bg-neutral-800' : 'bg-zinc-200'].join(' ')} />
      <Btn active={tightSpacing} onClick={onToggleTight} title="Toggle tight spacing">Tight Spacing</Btn>
    </div>
  );
}
