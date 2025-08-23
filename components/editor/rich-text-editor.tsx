'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
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
import toast from 'react-hot-toast';
import type { Template, Page } from '@/types/template';
import { createPortal } from 'react-dom';
import * as React from 'react';

/* ---------- floating popover helpers ---------- */
function useFloating(anchorRef: React.RefObject<HTMLElement>, open: boolean) {
  const [pos, setPos] = React.useState<{top:number; left:number; width:number; maxH:number}>({
    top: 0, left: 0, width: 384, maxH: 480
  });
  const recalc = React.useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = Math.min(416, vw - 16);
    const left = Math.min(vw - menuW - 8, Math.max(8, r.right - menuW));
    const top = Math.min(vh - 12, r.bottom + 8);
    const maxH = Math.max(160, Math.min(vh - top - 12, Math.floor(vh * 0.75)));
    setPos({ top, left, width: menuW, maxH });
  }, [anchorRef]);

  React.useEffect(() => {
    if (!open) return;
    recalc();
    const handler = () => recalc();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open, recalc]);

  return pos;
}

function AiMenuPopover({
  anchorRef,
  isDark,
  editor,
  ai,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  isDark: boolean;
  editor: any;
  ai: {
    busy: boolean;
    run: (id: any) => void;
    pageTitle: string;
    brief: string;
    setBrief: (v: string) => void;
  };
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const { top, left, width, maxH } = useFloating(anchorRef, true);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-label="AI assist"
        className={[
          'fixed z-[9999] rounded-lg shadow-lg border overflow-hidden',
          isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-200'
                 : 'bg-white border-zinc-200 text-zinc-800',
        ].join(' ')}
        style={{ top, left, width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col" style={{ maxHeight: maxH }}>
          <div className={[
            'sticky top-0 z-10 border-b px-3 py-2 backdrop-blur',
            isDark ? 'bg-neutral-900/95 border-neutral-800' : 'bg-white/95 border-zinc-200',
          ].join(' ')}>
            <div className="mb-2 text-xs opacity-80">
              Suggestions for <strong>{ai.pageTitle}</strong>
            </div>
            <label className={['mb-1 block text-[11px]', isDark ? 'text-neutral-300' : 'text-zinc-700'].join(' ')}>
              Brief (optional)
            </label>
            <textarea
              value={ai.brief}
              onChange={(e) => ai.setBrief(e.target.value)}
              rows={3}
              className={[
                'w-full resize-y rounded border px-2 py-1 text-sm',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
                isDark
                  ? 'bg-neutral-950 border-neutral-800 text-neutral-100 placeholder-neutral-500'
                  : 'bg-white border-zinc-300 text-zinc-800 placeholder-zinc-400',
              ].join(' ')}
              placeholder="Notes, constraints, keywords…"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] opacity-80">
              <div className="flex gap-3">
                <button
                  type="button"
                  className={isDark ? 'hover:text-white' : 'hover:text-black'}
                  onClick={() => {
                    const sel = editor.state.doc.textBetween(
                      editor.state.selection.from,
                      editor.state.selection.to,
                      ' '
                    );
                    ai.setBrief(sel.slice(0, 1200));
                  }}
                >
                  Use selection
                </button>
                <button type="button" onClick={() => ai.setBrief('')}>Clear</button>
              </div>
              <span>{ai.brief.length}/1200</span>
            </div>
          </div>

          <ul role="menu" className={['overflow-y-auto divide-y',
              isDark ? 'divide-neutral-800' : 'divide-zinc-200',
            ].join(' ')}>
            {[
              ['write_intro', 'Write intro (2–3 short paragraphs)'],
              ['faqs', 'Add FAQ section (5 Q&A)'],
              ['seo_bullets', 'Add SEO bullet list'],
              ['cta', 'Add Call-to-Action'],
              ['blog_intro', 'Blog intro'],
              ['ideas', 'Blog post ideas'],
              ['expand', 'Expand selection'],
              ['shorten', 'Shorten selection'],
              ['rewrite_simple', 'Rewrite simpler'],
            ].map(([id, label]) => (
              <li key={id as string} role="menuitem">
                <button
                  type="button"
                  onClick={() => ai.run(id)}
                  disabled={ai.busy}
                  className={[
                    'w-full text-left px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
                    'disabled:opacity-60',
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5',
                  ].join(' ')}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ---------- RTE helpers ---------- */
export type RichTextValue = {
  format?: 'tiptap' | 'html';
  json?: any;
  html?: string;
};

function buildEditorClass(tight: boolean, isDark: boolean) {
  const base = [
    'prose prose-slate',
    'max-w-none min-h-[240px]',
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

/* ---------- Site context pulled from DB-backed template ---------- */
function buildSiteSummary(template?: Template) {
  if (!template) return {};
  const t = template as any;
  const dataPages: Page[] = t.pages ?? t.data?.pages ?? [];

  const city = (t.city ?? '').toString().trim();
  const state = (t.state ?? '').toString().trim();
  const cityState = [city, state].filter(Boolean).join(', ');

  const services: string[] = Array.from(
    new Set(
      [
        ...(Array.isArray(t.services) ? t.services : []),
        ...dataPages
          .map((p) => p?.title || '')
          .filter(Boolean)
          .filter((title) => /service|towing|repair|roadside|cleaning|pressure/i.test(title)),
      ].filter(Boolean)
    )
  );

  return {
    businessName: (t.business_name ?? t.brand ?? t.template_name ?? t.slug ?? '').toString(),
    phone: (t.phone ?? '').toString(),
    industry: (t.industry ?? '').toString(),
    city,
    state,
    cityState,
    services,
    pages: dataPages.map((p) => ({ slug: p.slug, title: p.title })),
  };
}

type AIActionId =
  | 'write_intro'
  | 'faqs'
  | 'seo_bullets'
  | 'cta'
  | 'blog_intro'
  | 'ideas'
  | 'expand'
  | 'shorten'
  | 'rewrite_simple';

function aiInstructionFor(
  id: AIActionId,
  currentPage?: Page,
  site?: ReturnType<typeof buildSiteSummary>,
  selection?: string,
  brief?: string
) {
  const pageTitle = currentPage?.title || currentPage?.slug || 'this page';
  const phone = site?.phone ? ` Phone: ${site.phone}.` : '';
  const locLine = site?.city || site?.state ? ` Location: ${[site.city, site.state].filter(Boolean).join(', ')}.` : '';
  const biz = site?.businessName ? ` Business: ${site.businessName}.` : '';
  const services = site?.services?.length ? ` Services include: ${site.services.join(', ')}.` : '';
  const industry = site?.industry ? ` Industry: ${site.industry}.` : '';
  const extra = brief?.trim() ? `\n\nAdditional brief/context to respect:\n${brief.trim()}\n` : '';

  switch (id) {
    case 'write_intro':
      return `Write a concise 2–3 paragraph HTML intro for the page “${pageTitle}”.${locLine}${biz}${industry}${phone}${services}${extra}
Use <p> and optional <h2>. Avoid fluff; highlight value, safety, speed, and local expertise.`;
    case 'faqs':
      return `Create a <h2>FAQs</h2> section (5 Q&A pairs) for “${pageTitle}”. Use <h3> for questions and <p> for answers (1–2 sentences each). Keep specific to the locale and industry.${extra}`;
    case 'seo_bullets':
      return `Output a compact <ul> of 6–8 SEO bullet points for “${pageTitle}”, focusing on benefits, response time, coverage area, pricing clarity, and ${site?.industry || 'services'}.${extra}`;
    case 'cta':
      return `Write a strong <h2>Call Now</h2> and a short <p> CTA (≤ 90 words) tailored to “${pageTitle}”.${phone}${locLine}${extra}`;
    case 'blog_intro':
      return `Write an engaging blog intro (<h2> optional + 2 short <p>) connecting “${pageTitle}” to common customer problems. Professional, friendly.${extra}`;
    case 'ideas':
      return `List 10 blog post ideas as a <ul> for a ${site?.industry || 'local services'} business, relevant to “${pageTitle}” and the ${locLine || 'local area.'}${extra}`;
    case 'expand':
      return `Expand the following into richer HTML with <p>/<ul> only, preserving meaning and voice.${extra}\n\n${selection || ''}`;
    case 'shorten':
      return `Shorten the following into tighter copy (<p> only), keeping key facts.${extra}\n\n${selection || ''}`;
    case 'rewrite_simple':
      return `Rewrite the following at a 6th-grade reading level (<p> only).${extra}\n\n${selection || ''}`;
  }
}

export default function RichTextEditor({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder = '',
  onUploadImage,
  colorMode,
  template,          // ✅ DB-backed context
  currentPage,
}: {
  value: RichTextValue;
  onChange: (next: RichTextValue & { word_count?: number }) => void;
  onSave?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  onUploadImage?: (file: File) => Promise<string>;
  colorMode?: 'light' | 'dark';
  template?: Template;
  currentPage?: Page;
}) {
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

  const isDark = (colorMode ?? 'dark') === 'dark';
  const siteSummary = useMemo(() => buildSiteSummary(template), [template]);

  /* ---------- tiptap setup ---------- */
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

  const aiMenuBtnRef = useRef<HTMLButtonElement | null>(null);

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    content: '<p></p>',
    editorProps: {
      attributes: { class: buildEditorClass(tightSpacing, isDark) },
      handleKeyDown: (_view, event) => {
        // IME
        // // @ts-expect-error
        if (event.isComposing) return false;

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
        // ⌘/Ctrl + J opens AI menu
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
          event.preventDefault();
          aiMenuBtnRef.current?.click();
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

  useEffect(() => {
    if (!editor) return;
    if (value?.json)
      editor.commands.setContent(value.json, { parseOptions: { preserveWhitespace: 'full' } });
    else if (value?.html)
      editor.commands.setContent(value.html, { parseOptions: { preserveWhitespace: 'full' } });
  }, [editor, value?.json, value?.html]);

  /* ---------- AI actions ---------- */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiBrief, setAiBrief] = useState<string>(''); // ✨ brief seeded by selection

  const captureSelection = () => {
    if (!editor) return '';
    const sel = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    );
    return sel.trim();
  };

  const openAI = () => {
    const seed = captureSelection();
    setAiBrief(seed.slice(0, 1200));
    setAiOpen(true);
  };

  const runAI = async (id: AIActionId) => {
    if (!editor) return;
    setAiBusy(true);
    try {
      const selection = captureSelection();
      const instruction = aiInstructionFor(id, currentPage, siteSummary as any, selection, aiBrief);

      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          selection,
          brief: aiBrief,
          site: siteSummary,
          temperature: id === 'ideas' ? 0.9 : 0.7,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'AI request failed');

      const html: string = String(data.html || '').trim();
      if (!html) throw new Error('Empty AI response');

      if (id === 'expand' || id === 'shorten' || id === 'rewrite_simple') {
        editor.chain().focus().deleteSelection().insertContent(html).run();
      } else {
        editor.chain().focus().insertContent(html).run();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'AI error');
    } finally {
      setAiBusy(false);
      setAiOpen(false);
    }
  };

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
        ai={{
          open: aiOpen,
          busy: aiBusy,
          setOpen: (v) => (v ? openAI() : setAiOpen(false)),
          run: runAI,
          btnRef: aiMenuBtnRef,
          pageTitle: currentPage?.title || currentPage?.slug || 'this page',
          brief: aiBrief,
          setBrief: setAiBrief,
        }}
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
  ai,
}: {
  editor: Editor;
  tightSpacing: boolean;
  onToggleTight: () => void;
  isDark: boolean;
  ai: {
    open: boolean;
    busy: boolean;
    setOpen: (v: boolean) => void;
    run: (id: any) => void;
    btnRef: React.RefObject<HTMLButtonElement | null>;
    pageTitle: string;
    brief: string;
    setBrief: (v: string) => void;
  };
}) {
  const Btn = (props: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      className={[
        'px-2 py-1 rounded-md text-sm transition',
        props.disabled ? 'opacity-60 cursor-not-allowed' : '',
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

      {/* ✨ AI menu */}
      <div className="relative ml-auto">
        <button
          ref={ai.btnRef}
          type="button"
          onClick={() => ai.setOpen(!ai.open)}
          disabled={ai.busy}
          className={[
            'px-2 py-1 rounded-md text-sm',
            ai.busy ? 'opacity-60 cursor-wait' : '',
            isDark ? 'text-neutral-200 hover:bg-neutral-800' : 'text-zinc-700 hover:bg-zinc-100',
          ].join(' ')}
          title="AI assist (⌘/Ctrl + J)"
        >
          ✨ AI
        </button>

        {ai.open && (
          <AiMenuPopover
            anchorRef={ai.btnRef as any}
            isDark={isDark}
            editor={editor}
            ai={{ busy: ai.busy, run: ai.run, pageTitle: ai.pageTitle, brief: ai.brief, setBrief: ai.setBrief }}
            onClose={() => ai.setOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
