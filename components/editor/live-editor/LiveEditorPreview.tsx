'use client';

import { useEffect, useState } from 'react';
import { X, Moon, Sun } from 'lucide-react';
import { TemplateThemeWrapper } from '@/components/theme/template-theme-wrapper';
import { useTheme } from '@/hooks/useThemeContext';
import GlobalChromeEditors from '@/components/admin/templates/global-chrome-editors';
import PageTabsBar from '@/components/admin/templates/page-tabs-bar';
import { saveTemplate } from '@/admin/lib/saveTemplate';
import { getEffectiveFooter, getEffectiveHeader, getPages, slugify, withSyncedPages } from '@/components/editor/live-editor/helpers';
import { useImmersive, useSelectedPageId } from '@/components/editor/live-editor/hooks';
import BlocksList from '@/components/editor/live-editor/BlocksList';
import EmptyAddBlock from '@/components/editor/live-editor/EmptyAddBlock';
import RenderBlock from '@/components/admin/templates/render-block';
import type { Template, Page } from '@/types/template';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import Portal from '@/components/ui/portal';

export default function LiveEditorPreview({
  template,
  onChange,
  industry,
  errors,
  templateId,
}: {
  template: Template;
  onChange: (template: Template) => void;
  industry: string;
  errors: Record<string, BlockValidationError[]>;
  templateId: string;
}) {
  const [editing, setEditing] = useState<any | null>(null);
  const [lastInsertedId, setLastInsertedId] = useState<string | null>(null);
  const [showOutlines] = useState(false);

  const { theme: ctxTheme, setTheme } = useTheme();
  const resolvedColorMode =
    ((template as any).color_mode as 'light' | 'dark' | undefined) ??
    (ctxTheme?.darkMode as 'light' | 'dark' | undefined) ??
    'light';

  const pages = getPages(template);
  const STORAGE_KEY = `qs:selectedPageId:${templateId}`;
  const { selectedPageId, setSelectedPageId, selectedPageIndex, selectedPage } =
    useSelectedPageId(pages, STORAGE_KEY);
  const hasBlocks = (selectedPage?.content_blocks?.length ?? 0) > 0;

  const { isImmersive, enterImmersive, exitImmersive } = useImmersive();

  useEffect(() => {
    const root = document.documentElement;
    if (editing) root.classList.add('qs-modal-open');
    return () => root.classList.remove('qs-modal-open');
  }, [editing]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedColorMode === 'dark');
  }, [resolvedColorMode]);

  useEffect(() => {
    const tMode = (template as any).color_mode as 'light' | 'dark' | undefined;
    if (tMode && ctxTheme?.darkMode !== tMode) {
      setTheme({ ...(ctxTheme || {}), darkMode: tMode } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(template as any).color_mode]);

  // Save util (preserves color mode)
  const updateAndSave = async (updatedRaw: Template) => {
    const ensuredColor = ((updatedRaw as any).color_mode as 'light' | 'dark' | undefined) ?? resolvedColorMode;
    const ensured: Template = { ...updatedRaw, color_mode: ensuredColor } as any;

    const updated = withSyncedPages(ensured);
    onChange({ ...updated });
    try {
      const validId = updated.id && updated.id.trim() !== '' ? updated.id : undefined;
      if (!validId) throw new Error('Missing template ID');
      await saveTemplate(updated, validId);
    } catch (err) {
      console.error('❌ Failed to save template update', err);
    }
  };

  // color mode toggle
  const toggleColorMode = async () => {
    const next = resolvedColorMode === 'dark' ? 'light' : 'dark';
    setTheme({ ...(ctxTheme || {}), darkMode: next } as any);
    const keepId = selectedPageId;
    await updateAndSave({ ...template, color_mode: next as 'light' | 'dark' });
    if (keepId) setSelectedPageId(keepId);
  };

  useEffect(() => {
    if (!lastInsertedId) return;
    const el = document.querySelector<HTMLElement>(`[data-block-id="${lastInsertedId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [lastInsertedId]);

  if (!selectedPage) {
    return (
      <div className="p-8 text-white text-center">
        <div className="text-lg font-semibold mb-2">No page found</div>
        <p className="text-sm text-white/70">The template has no pages defined yet. Add one to begin editing.</p>
      </div>
    );
  }

  const effectiveHeader = getEffectiveHeader(selectedPage, template);
  const effectiveFooter = getEffectiveFooter(selectedPage, template);

  const setPageChrome = async (key: 'show_header' | 'show_footer', value: boolean) => {
    const updatedPage = { ...selectedPage, [key]: value };
    const next = withSyncedPages({
      ...template,
      color_mode: resolvedColorMode,
      data: {
        ...(template.data ?? {}),
        pages: pages.map((p: any, idx: number) => (idx === selectedPageIndex ? updatedPage : p)),
      },
    } as Template);
    await updateAndSave(next);
  };

  return (
    <TemplateThemeWrapper colorMode={resolvedColorMode}>
      {isImmersive && (
        <button
          onClick={exitImmersive}
          aria-label="Exit full screen"
          title="Exit full screen (Esc)"
          className="fixed top-3 left-3 z-[1000] rounded-full p-2
                     bg-black/60 border border-purple-500/60
                     shadow-[0_0_0_2px_rgba(168,85,247,.35),0_0_18px_2px_rgba(168,85,247,.35)]
                     hover:bg-black/70 transition"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      )}

      <div className="w-full max-w-none px-0">
        <button
          onClick={toggleColorMode}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
          aria-label="Toggle color mode"
          title="Toggle color mode"
        >
          {resolvedColorMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          {resolvedColorMode === 'dark' ? 'Dark' : 'Light'}
        </button>

        <div className="relative min-h-screen">
          <div className="px-0 sm:px-2 xl:px-0 pb-20 pt-4 space-y-6 w-full xl:max-w-[90%] xl:mx-auto">
            <GlobalChromeEditors
              template={template}
              onChange={onChange}
              onSaveTemplate={updateAndSave}
            />

            {/* Page toggles */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs uppercase tracking-wide text-black/60 dark:text-white/60">Page Settings:</span>
              <button
                type="button"
                onClick={() => setPageChrome('show_header', !(selectedPage?.show_header !== false))}
                className={`px-2 py-1 text-xs rounded border transition
                  ${selectedPage?.show_header !== false
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-600 hover:bg-zinc-700'}`}
              >
                Header: {selectedPage?.show_header !== false ? 'Visible' : 'Hidden'}
              </button>
              <button
                type="button"
                onClick={() => setPageChrome('show_footer', !(selectedPage?.show_footer !== false))}
                className={`px-2 py-1 text-xs rounded border transition
                  ${selectedPage?.show_footer !== false
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-600 hover:bg-zinc-700'}`}
              >
                Footer: {selectedPage?.show_footer !== false ? 'Visible' : 'Hidden'}
              </button>
            </div>

            <PageTabsBar
              pages={pages}
              selectedIndex={selectedPageIndex}
              template={template}
              onSelect={(i) => setSelectedPageId(pages[i]?.id ?? null)}
              onAdd={(newPage) => {
                const ensured: Page = { ...newPage, id: newPage.id || crypto.randomUUID() };
                const next = withSyncedPages({
                  ...template,
                  data: { ...(template.data ?? {}), pages: [...pages, ensured] },
                  color_mode: resolvedColorMode,
                } as Template);
                updateAndSave(next);
                setSelectedPageId(ensured.id);
              }}
              onRename={(index, title, incomingSlug) => {
                let nextSlug = (incomingSlug && incomingSlug.trim()) || slugify(title);
                const others = new Set(pages.map((p, i) => (i === index ? '' : p.slug)));
                const base = nextSlug.replace(/-\d+$/, '');
                let n = 2;
                while (others.has(nextSlug)) nextSlug = `${base}-${n++}`;

                const updated = pages.map((p, i) => (i === index ? { ...p, title, slug: nextSlug } : p));
                const next = withSyncedPages({
                  ...template,
                  data: { ...(template.data ?? {}), pages: updated },
                  color_mode: resolvedColorMode,
                } as Template);
                updateAndSave(next);
                setSelectedPageId(updated[index]?.id ?? null);
              }}
              onDelete={(index) => {
                if (pages.length <= 1) {
                  alert('You must keep at least one page.');
                  return;
                }
                const updated = pages.filter((_, i) => i !== index);
                const next = withSyncedPages({
                  ...template,
                  data: { ...(template.data ?? {}), pages: updated },
                  color_mode: resolvedColorMode,
                } as Template);
                updateAndSave(next);
                const newIdx = Math.min(updated.length - 1, Math.max(0, index - 1));
                setSelectedPageId(updated[newIdx]?.id ?? null);
              }}
              onReorder={(oldIndex, newIndex) => {
                if (oldIndex === newIndex) return;
                const copy = [...pages];
                const [moved] = copy.splice(oldIndex, 1);
                copy.splice(newIndex, 0, moved);
                const next = withSyncedPages({
                  ...template,
                  data: { ...(template.data ?? {}), pages: copy },
                  color_mode: resolvedColorMode,
                } as Template);
                updateAndSave(next);
                setSelectedPageId(moved.id);
              }}
            />

            {effectiveHeader && (
              <RenderBlock block={effectiveHeader} showDebug={false} colorMode={resolvedColorMode} />
            )}

            <BlocksList
              template={template}
              colorMode={resolvedColorMode}
              pages={pages}
              selectedPage={selectedPage}
              selectedPageIndex={selectedPageIndex}
              showOutlines={showOutlines}
              onUpdateAndSave={updateAndSave}
              onEditBlock={setEditing}
              setLastInsertedId={(id) => setLastInsertedId(id)}
            />

            {!hasBlocks && (
              <EmptyAddBlock
                existingBlocks={selectedPage.content_blocks}
                onAdd={(type) => {
                  const newBlock = createDefaultBlock(type as any);
                  const updatedPage = {
                    ...selectedPage,
                    content_blocks: [...(selectedPage?.content_blocks ?? []), newBlock as any],
                  };
                  setLastInsertedId((newBlock as any)._id ?? '');
                  setEditing(newBlock as any);
                  const next = withSyncedPages({
                    ...template,
                    color_mode: resolvedColorMode,
                    data: {
                      ...(template.data ?? {}),
                      pages: pages.map((p: any, idx: number) =>
                        idx === selectedPageIndex ? updatedPage : p
                      ),
                    },
                  } as Template);
                  updateAndSave(next);
                }}
              />
            )}

            {effectiveFooter && (
              <RenderBlock block={effectiveFooter} showDebug={false} colorMode={resolvedColorMode} />
            )}
          </div>
        </div>

        {editing && (
            <Portal>
                <div
                className={[
                    resolvedColorMode === 'dark' ? 'dark' : '',
                    'fixed inset-0 z-[1200] bg-black/90 p-6 overflow-auto flex items-center justify-center',
                ].join(' ')}
                >
                <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                    <DynamicBlockEditor
                    block={editing}
                    onSave={(updatedBlock: any) => {
                        const updatedPage = {
                        ...selectedPage,
                        content_blocks: (selectedPage?.content_blocks ?? []).map((b: any) =>
                            b._id === updatedBlock._id ? updatedBlock : b
                        ),
                        };
                        const next = withSyncedPages({
                        ...template,
                        color_mode: resolvedColorMode,
                        data: {
                            ...(template.data ?? {}),
                            pages: pages.map((p: any, idx: number) =>
                            idx === selectedPageIndex ? updatedPage : p
                            ),
                        },
                        } as Template);
                        updateAndSave(next);
                        setEditing(null);
                    }}
                    onClose={() => setEditing(null)}
                    errors={errors}
                    template={template}
                    />
                </div>
                </div>
            </Portal>
            )}
      </div>
    </TemplateThemeWrapper>
  );
}
