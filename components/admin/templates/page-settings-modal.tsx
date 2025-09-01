// components/admin/templates/page-settings-modal.tsx
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { Page, Template } from '@/types/template';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import { Wand2 } from 'lucide-react';

type Props = {
  open: boolean;
  page: Page | null;
  onClose: () => void;
  onSave: (updated: Page) => void;
  template?: Template;
  errors?: any;
  onSaveGlobalFooter?: (footerBlock: any) => void;
  onSaveGlobalHeader?: (headerBlock: any) => void;
};

function makeEmptyHeader(): any {
  return {
    type: 'header',
    _id: (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).slice(0, 24),
    content: {},
  };
}
function makeEmptyFooter(): any {
  return {
    type: 'footer',
    _id: (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).slice(0, 24),
    content: {},
  };
}

function sanitizeSlug(raw: string) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')       // spaces/underscores → dash
    .replace(/[^a-z0-9-]/g, '')    // strip non-url-safe
    .replace(/-+/g, '-')           // collapse dashes
    .replace(/^-|-$/g, '');        // trim leading/trailing dash
  return s || 'page';
}

export default function PageSettingsModal({
  open,
  page,
  onClose,
  onSave,
  template,
  errors,
  onSaveGlobalFooter,
  onSaveGlobalHeader,
}: Props) {
  const [local, setLocal] = React.useState<Page | null>(page);
  React.useEffect(() => setLocal(page), [page]);
  if (!local) return null;

  // Disable the bottom editor toolbar while this modal is open
  React.useEffect(() => {
    const setToolbarEnabled = (enabled: boolean) =>
      window.dispatchEvent(new CustomEvent('qs:toolbar:set-enabled', { detail: enabled }));
    if (open) setToolbarEnabled(false);
    return () => {
      setToolbarEnabled(true);
    };
  }, [open]);

  const set = <K extends keyof Page>(key: K, val: Page[K]) =>
    setLocal({ ...(local as Page), [key]: val });

  const overridesEnabled = Boolean(local.headerOverride || local.footerOverride);
  const resolvedColorMode = (template?.color_mode as 'light' | 'dark') || 'dark';

  // Global header/footer editing state
  const initialGlobalHeader =
    (template as any)?.headerBlock ??
    (template as any)?.data?.headerBlock ??
    makeEmptyHeader();

  const initialGlobalFooter =
    (template as any)?.footerBlock ??
    (template as any)?.data?.footerBlock ??
    makeEmptyFooter();

  const [editGlobalHeader, setEditGlobalHeader] = React.useState(false);
  const [editGlobalFooter, setEditGlobalFooter] = React.useState(false);

  const [globalHeader, setGlobalHeader] = React.useState<any>(initialGlobalHeader);
  const [globalFooter, setGlobalFooter] = React.useState<any>(initialGlobalFooter);

  React.useEffect(() => {
    const gh =
      (template as any)?.headerBlock ??
      (template as any)?.data?.headerBlock ??
      makeEmptyHeader();
    const gf =
      (template as any)?.footerBlock ??
      (template as any)?.data?.footerBlock ??
      makeEmptyFooter();
    setGlobalHeader(gh);
    setGlobalFooter(gf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  const dispatchTemplatePatch = React.useCallback((patch: any) => {
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch }));
  }, []);

  const handleSaveAll = () => {
    onSave(local);

    // Global header
    if (editGlobalHeader && globalHeader) {
      if (onSaveGlobalHeader) {
        onSaveGlobalHeader(globalHeader);
      } else {
        dispatchTemplatePatch({
          headerBlock: globalHeader,
          data: { ...(template?.data as any), headerBlock: globalHeader },
        });
      }
    }

    // Global footer
    if (editGlobalFooter && globalFooter) {
      if (onSaveGlobalFooter) {
        onSaveGlobalFooter(globalFooter);
      } else {
        dispatchTemplatePatch({
          footerBlock: globalFooter,
          data: { ...(template?.data as any), footerBlock: globalFooter },
        });
      }
    }

    onClose();
  };

  const onBlurSlug = () => {
    const fixed = sanitizeSlug(local.slug || '');
    if (fixed !== local.slug) set('slug', fixed);
  };

  const canSave = Boolean(local.slug && local.title); // simple guard

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* Force dark palette inside the modal */}
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-neutral-950 text-zinc-100 shadow-2xl">
        <div className="dark flex max-h-[85vh] flex-col">
          {/* Sticky header */}
          <DialogHeader className="sticky top-0 z-10 border-b border-zinc-800 bg-neutral-950/95 backdrop-blur px-6 pt-4 pb-3">
            <DialogTitle className="text-zinc-100">
              Page Settings — {local.title || local.slug}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <div
            id="page-settings-scroll"
            className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-6"
            role="region"
            aria-label="Page settings content"
          >
            {/* Slug / Title */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="slug" className="text-zinc-300">
                    Slug
                  </Label>
                  <Input
                    id="slug"
                    value={local.slug}
                    onChange={(e) => set('slug', e.target.value)}
                    onBlur={onBlurSlug}
                    placeholder="about-us"
                    className="bg-neutral-900 border-neutral-700 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>
                <div>
                  <Label htmlFor="title" className="text-zinc-300">
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={local.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="About Us"
                    className="bg-neutral-900 border-neutral-700 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>
              </div>
              <div className="self-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => set('slug', sanitizeSlug(local.slug))}
                  title="Sanitize slug"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Fix
                </Button>
              </div>
            </div>

            {/* Visibility toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded border border-zinc-800 bg-neutral-900/40 px-3 py-2">
                <div>
                  <Label className="mb-0 text-zinc-300">Show Header</Label>
                  <p className="text-xs text-zinc-500">
                    Toggle global header visibility for this page.
                  </p>
                </div>
                <Switch
                  checked={local.show_header !== false}
                  onCheckedChange={(ck) => set('show_header', ck)}
                />
              </div>

              <div className="flex items-center justify-between rounded border border-zinc-800 bg-neutral-900/40 px-3 py-2">
                <div>
                  <Label className="mb-0 text-zinc-300">Show Footer</Label>
                  <p className="text-xs text-zinc-500">
                    Toggle global footer visibility for this page.
                  </p>
                </div>
                <Switch
                  checked={local.show_footer !== false}
                  onCheckedChange={(ck) => set('show_footer', ck)}
                />
              </div>
            </div>

            {/* Global header/footer editors */}
            <div className="rounded border border-zinc-800 bg-neutral-900/40 p-3 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="mb-0 text-zinc-300">Edit global header</Label>
                  <p className="text-xs text-zinc-500">
                    Modify the <strong>template’s</strong> header (applies to all pages that don’t override it).
                  </p>
                </div>
                <Switch
                  checked={editGlobalHeader}
                  onCheckedChange={(ck) => setEditGlobalHeader(ck)}
                />
              </div>
              {editGlobalHeader && (
                <div className="rounded border border-zinc-800 bg-neutral-900/40 p-2">
                  <div className="text-sm font-medium mb-2 text-zinc-200">Global Header</div>
                  <DynamicBlockEditor
                    block={globalHeader as any}
                    template={template as any}
                    errors={errors}
                    onSave={(b) => setGlobalHeader(b as any)}
                    onClose={() => {}}
                    colorMode={resolvedColorMode}
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label className="mb-0 text-zinc-300">Edit global footer</Label>
                  <p className="text-xs text-zinc-500">
                    Modify the <strong>template’s</strong> footer (applies to all pages that don’t override it).
                  </p>
                </div>
                <Switch
                  checked={editGlobalFooter}
                  onCheckedChange={(ck) => setEditGlobalFooter(ck)}
                />
              </div>

              {editGlobalFooter && (
                <div className="rounded border border-zinc-800 bg-neutral-900/40 p-2">
                  <div className="text-sm font-medium mb-2 text-zinc-200">Global Footer</div>
                  <DynamicBlockEditor
                    block={globalFooter as any}
                    template={template as any}
                    errors={errors}
                    onSave={(b) => setGlobalFooter(b as any)}
                    onClose={() => {}}
                    colorMode={resolvedColorMode}
                  />
                </div>
              )}
            </div>

            {/* Per-page overrides */}
            <div className="rounded border border-zinc-800 bg-neutral-900/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="mb-0 text-zinc-300">Use custom header/footer on this page</Label>
                  <p className="text-xs text-zinc-500">
                    When enabled, this page’s custom header/footer replace the global ones.
                  </p>
                </div>
                <Switch
                  checked={overridesEnabled}
                  onCheckedChange={(ck) => {
                    if (ck) {
                      set(
                        'headerOverride',
                        local.headerOverride ??
                          ({ type: 'header', _id: crypto.randomUUID(), content: {} } as any)
                      );
                      set(
                        'footerOverride',
                        local.footerOverride ??
                          ({ type: 'footer', _id: crypto.randomUUID(), content: {} } as any)
                      );
                    } else {
                      set('headerOverride', null as any);
                      set('footerOverride', null as any);
                    }
                  }}
                />
              </div>

              {overridesEnabled && (
                <div className="space-y-4">
                  <div className="rounded border border-zinc-800 bg-neutral-900/40 p-2">
                    <div className="text-sm font-medium mb-2 text-zinc-200">Custom Header</div>
                    <DynamicBlockEditor
                      block={local.headerOverride as any}
                      template={template as any}
                      errors={errors}
                      onSave={(b) => set('headerOverride', b as any)}
                      onClose={() => {}}
                      colorMode={resolvedColorMode}
                    />
                  </div>

                  <div className="rounded border border-zinc-800 bg-neutral-900/40 p-2">
                    <div className="text-sm font-medium mb-2 text-zinc-200">Custom Footer</div>
                    <DynamicBlockEditor
                      block={local.footerOverride as any}
                      template={template as any}
                      errors={errors}
                      onSave={(b) => set('footerOverride', b as any)}
                      onClose={() => {}}
                      colorMode={resolvedColorMode}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky footer */}
          <DialogFooter className="sticky bottom-0 z-10 border-t border-zinc-800 bg-neutral-950/95 backdrop-blur px-6 py-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSaveAll} disabled={!canSave} title={!canSave ? 'Slug and Title are required' : ''}>
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
