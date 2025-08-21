// components/admin/templates/template-editor-content.tsx
'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import type { Template, TemplateData } from '@/types/template';
import type { Block } from '@/types/blocks';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import LiveEditorPreview from '@/components/editor/live-editor/LiveEditorPreview';
import { Settings as SettingsIcon } from 'lucide-react';

/** Lazy import the sidebar to avoid SSR issues */
const SidebarSettings = dynamic(() => import('@/components/admin/template-settings-panel/sidebar-settings'), {
  ssr: false,
});

/** Widen TemplateData locally so we can store chrome inside data safely. */
type TemplateDataWithChrome = TemplateData & {
  headerBlock?: Block | null;
  footerBlock?: Block | null;
};

type Props = {
  template: Template;

  // Props used by toolbar / device toggles / JSON panel
  rawJson: string;
  setRawJson: Dispatch<SetStateAction<string>>;
  livePreviewData: TemplateData;                    // accepted but not forwarded (LP doesn't need it)
  setTemplate: Dispatch<SetStateAction<Template>>;
  autosaveStatus?: string;                          // accepted to keep caller happy
  setShowPublishModal?: (open: boolean) => void;    // accepted to keep caller happy
  recentlyInsertedBlockId?: string | null;          // accepted to keep caller happy

  // Validation
  setBlockErrors: (errors: Record<string, BlockValidationError[]>) => void;
  blockErrors: Record<string, BlockValidationError[]>;

  // Editor mode + patcher
  mode: 'template' | 'site';
  onChange: (patch: Partial<Template>) => void;
};

/**
 * Main editor content area:
 * - Left: Settings sidebar (toggle with “S”)
 * - Right: Live preview (with bottom toolbar & device toggles inside LP)
 * - Header overlay edit preserved
 */
export default function EditorContent({
  template,
  rawJson,
  setRawJson,
  livePreviewData,        // eslint-disable-line @typescript-eslint/no-unused-vars
  setTemplate,
  autosaveStatus,         // eslint-disable-line @typescript-eslint/no-unused-vars
  setShowPublishModal,    // eslint-disable-line @typescript-eslint/no-unused-vars
  recentlyInsertedBlockId,// eslint-disable-line @typescript-eslint/no-unused-vars
  setBlockErrors,
  blockErrors,
  mode,
  onChange,
}: Props) {
  // When non-null, show overlay editor for the header
  const [editingHeader, setEditingHeader] = useState<Block | null>(null);

  // Settings sidebar visibility
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Keyboard: toggle Settings with "s"
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      const editable =
        (n.getAttribute?.('contenteditable') || '').toLowerCase() === 'true' ||
        n.closest?.('[contenteditable="true"]');
      const tag = (n.tagName || '').toLowerCase();
      const isForm =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (n as HTMLInputElement).type === 'text';
      const isEditors =
        n.closest?.('.cm-editor, .CodeMirror, .ProseMirror'); // CodeMirror/ProseMirror
      return !!(editable || isForm || isEditors);
    };

    const onKey = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      const code = (e.code || '').toLowerCase(); // e.g., 'keys'
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (key === 's' || code === 'keys') {
          if (isTypingTarget(e.target)) return;
          e.preventDefault();
          setShowSettings(prev => !prev);
        }
      }
    };

    // capture=true so inner handlers can't swallow it
    window.addEventListener('keydown', onKey, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, []);


  // Keep preview scrolled to header when it opens
  useEffect(() => {
    if (!editingHeader) return;
    document
      .querySelector<HTMLElement>('[data-site-header], .qs-site-header')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingHeader]);

  /** Resolve an existing header block or seed a sensible default. */
  const resolveHeader = (): Block => {
    const existing =
      (template as any)?.data?.headerBlock ||
      (template as any)?.headerBlock ||
      null;

    if (existing?.type === 'header') return existing as Block;

    // Seed a default header and prime nav from first few pages
    const seeded = createDefaultBlock('header') as Block;
    const navItems =
      (template?.data?.pages ?? [])
        .slice(0, 5)
        .map((p) => ({ label: p.title || p.slug, href: `/${p.slug}` })) ?? [];
    (seeded as any).content = {
      ...(seeded as any).content,
      navItems:
        (seeded as any).content?.navItems?.length
          ? (seeded as any).content.navItems
          : navItems,
    };
    return seeded;
  };

  /** Triggered by the preview’s header hover “Edit” button. */
  const openHeaderEditor = () => setEditingHeader(resolveHeader());

  /** Persist the header back into template (top-level mirror + data). */
  const saveHeader = (updatedHeader: Block) => {
    const nextData: TemplateDataWithChrome = {
      ...(template.data as TemplateDataWithChrome),
      headerBlock: updatedHeader as Block,
    };

    const next: Template = {
      ...template,
      headerBlock: updatedHeader as any, // mirror if referenced elsewhere
      data: nextData as Template['data'],
    };

    onChange(next); // Partial<Template> accepts a full Template
    setEditingHeader(null);

    // keep user oriented
    setTimeout(() => {
      document
        .querySelector<HTMLElement>('[data-site-header], .qs-site-header')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  // Adapt (patch) → (full template) for LiveEditorPreview
  const handlePreviewChange = (t: Template) => onChange(t);

  // Safe onChange for sidebar (handles either patch or full template)
  const handleSidebarChange = (patchOrFull: Partial<Template> | Template) => {
    onChange(patchOrFull as Partial<Template>);
  };

  return (
    <div className="flex min-w-0">
      {/* ===== Left Settings Sidebar ===== */}
      <aside
        className={[
          'fixed z-[1100] inset-y-0 left-0 w-[300px] bg-neutral-950 border-r border-white/10',
          'transform transition-transform duration-200 ease-out',
          showSettings ? 'translate-x-0' : '-translate-x-full',
          // On xl screens, allow docked view by default (optional):
          // 'xl:static xl:translate-x-0 xl:block',
        ].join(' ')}
        aria-label="Settings"
      >
        <div className="h-full overflow-auto">
          {/* Guard if the dynamic import hasn’t loaded yet */}
          {SidebarSettings ? (
            <SidebarSettings template={template} onChange={handleSidebarChange as any} />
          ) : (
            <div className="p-4 text-sm text-white/70">Loading settings…</div>
          )}
        </div>

        {/* Toggle hint for users */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/40">
          Press <kbd className="px-1 py-0.5 bg-white/10 rounded">S</kbd> to toggle
        </div>

        <button
          className="fixed bottom-4 left-4 z-[1400] rounded-full p-2
                    border border-white/10 bg-zinc-900/90 text-white/85 shadow-lg
                    hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
          onClick={() => setShowSettings(prev => !prev)}
          aria-label={showSettings ? 'Hide settings' : 'Show settings'}
          aria-pressed={showSettings}
          title={`${showSettings ? 'Hide' : 'Show'} settings (S)`}
        >
          <SettingsIcon size={18} />
        </button>
        {/* Close button (mobile/tablet) */}
        <button
          className="xl:hidden absolute top-2 right-2 text-white/70 hover:text-white"
          onClick={() => setShowSettings(false)}
          aria-label="Close settings"
          title="Close"
        >
          ✕
        </button>
      </aside>
      {/* ===== /Left Settings Sidebar ===== */}

      {/* ===== Right: Live Preview ===== */}
      <div className="flex-1 min-w-0 xl:ml-0 ml-0">
        <LiveEditorPreview
          // Core
          template={template}
          onChange={handlePreviewChange}
          errors={blockErrors}
          industry={template.industry}
          templateId={template.id}
          mode={mode}
          // JSON panel / toolbar hooks
          rawJson={rawJson}
          setRawJson={setRawJson}
          setTemplate={(t) => setTemplate(t)}
          // Header chrome
          showEditorChrome
          onEditHeader={openHeaderEditor}
        />
      </div>
      {/* ===== /Right: Live Preview ===== */}

      {/* Overlay editor for header */}
      {editingHeader && (
        <div className="fixed inset-0 z-[1200] bg-black/90 p-6 overflow-auto flex items-center justify-center">
          <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <DynamicBlockEditor
              block={editingHeader}
              onSave={(b: any) => saveHeader(b as Block)}
              onClose={() => setEditingHeader(null)}
              errors={blockErrors}
              template={template}
              colorMode={template?.color_mode || 'dark'}
            />
          </div>
        </div>
      )}

      {/* Floating open button when hidden on smaller screens */}
      {!showSettings && (
        <button
          className="xl:hidden fixed bottom-4 left-4 z-[1200] rounded-md border border-white/10 bg-zinc-900/90 text-white/80 text-xs px-3 py-2 hover:bg-zinc-800"
          onClick={() => setShowSettings(true)}
          title="Open settings (S)"
          aria-label="Open settings"
        >
          Settings
        </button>
      )}
    </div>
  );
}
