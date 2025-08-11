// components/admin/templates/page-settings-modal.tsx
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { Page, Template } from '@/types/template';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';

type Props = {
  open: boolean;
  page: Page | null;
  onClose: () => void;
  onSave: (updated: Page) => void;
  template?: Template; // optional: for passing errors/theme if you want
  errors?: any;
};

export default function PageSettingsModal({ open, page, onClose, onSave, template, errors }: Props) {
  const [local, setLocal] = React.useState<Page | null>(page);

  React.useEffect(() => setLocal(page), [page]);

  if (!local) return null;

  const set = <K extends keyof Page>(key: K, val: Page[K]) => setLocal({ ...(local as Page), [key]: val });

  const overridesEnabled = Boolean(local.headerOverride || local.footerOverride);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Page Settings — {local.title || local.slug}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={local.slug}
                onChange={(e) => set('slug', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={local.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>
          </div>

          {/* Visibility toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded border px-3 py-2">
              <div>
                <Label className="mb-0">Show Header</Label>
                <p className="text-xs text-muted-foreground">Toggle global header visibility for this page.</p>
              </div>
              <Switch
                checked={local.show_header !== false}
                onCheckedChange={(ck) => set('show_header', ck)}
              />
            </div>

            <div className="flex items-center justify-between rounded border px-3 py-2">
              <div>
                <Label className="mb-0">Show Footer</Label>
                <p className="text-xs text-muted-foreground">Toggle global footer visibility for this page.</p>
              </div>
              <Switch
                checked={local.show_footer !== false}
                onCheckedChange={(ck) => set('show_footer', ck)}
              />
            </div>
          </div>

          {/* Per-page overrides */}
          <div className="rounded border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="mb-0">Use custom header/footer on this page</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, this page’s custom header/footer replace the global ones.
                </p>
              </div>
              <Switch
                checked={overridesEnabled}
                onCheckedChange={(ck) => {
                  if (ck) {
                    set('headerOverride', local.headerOverride ?? { type: 'header', _id: crypto.randomUUID(), content: {} } as any);
                    set('footerOverride', local.footerOverride ?? { type: 'footer', _id: crypto.randomUUID(), content: {} } as any);
                  } else {
                    set('headerOverride', null as any);
                    set('footerOverride', null as any);
                  }
                }}
              />
            </div>

            {overridesEnabled && (
              <div className="space-y-4">
                <div className="rounded border p-2">
                  <div className="text-sm font-medium mb-2">Custom Header</div>
                  <DynamicBlockEditor
                    block={local.headerOverride as any}
                    template={template as any}
                    errors={errors}
                    onSave={(b) => set('headerOverride', b as any)}
                    onClose={() => {}}
                  />
                </div>
                <div className="rounded border p-2">
                  <div className="text-sm font-medium mb-2">Custom Footer</div>
                  <DynamicBlockEditor
                    block={local.footerOverride as any}
                    template={template as any}
                    errors={errors}
                    onSave={(b) => set('footerOverride', b as any)}
                    onClose={() => {}}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onSave(local);
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
