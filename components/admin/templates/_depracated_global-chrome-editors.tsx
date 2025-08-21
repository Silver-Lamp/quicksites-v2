// components/admin/templates/global-chrome-editors.tsx
'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import type { Template } from '@/types/template';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

type Props = {
  template: Template;
  onChange: (t: Template) => void;
  onSaveTemplate: (t: Template) => Promise<void>;
  colorMode?: 'light' | 'dark';
  rawJson: string;
  setRawJson: (rawJson: string) => void;
  setTemplate: (template: Template) => void;
};

export default function GlobalChromeEditors({ template, onChange, onSaveTemplate, rawJson, setRawJson, setTemplate }: Props) {
  const [editing, setEditing] = React.useState<'header' | 'footer' | null>(null);
  const [draftBlock, setDraftBlock] = React.useState<any | null>(null);

  const openEditor = (which: 'header' | 'footer') => {
    setEditing(which);
    const existing =
      which === 'header' ? (template.headerBlock as any) : (template.footerBlock as any);
    // If missing, create a sensible default so the editor has something to edit
    setDraftBlock(
      existing ??
        (createDefaultBlock(which) as any) // assumes your factory supports 'header' | 'footer'
    );
  };

  const close = () => {
    setEditing(null);
    setDraftBlock(null);
  };

  const hasHeader = !!template.headerBlock;
  const hasFooter = !!template.footerBlock;

  const resolvedColorMode = (rawJson as any)?.color_mode || 'dark';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-3 bg-zinc-900 border border-zinc-700 hover:border-purple-500 transition-colors">
    <div className="flex items-center justify-between">
        <div>
        <div className="text-sm font-semibold text-white">Global Header and Footer</div>
        <div className="text-xs text-zinc-300">
            Shown on pages unless hidden or overridden.
        </div>
        {/* {!hasHeader && (
            <div className="mt-1 inline-block rounded bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5">
            Not set
            </div>
        )} */}
        </div>
        <Button
        size="sm"
        className="bg-purple-600 hover:bg-purple-500 text-white"
        onClick={() => openEditor('header')}
        >
        {hasHeader ? 'Edit Header' : 'Create Header'}
        </Button>
        <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-500 text-white"
            onClick={() => openEditor('footer')}
            >
            {hasFooter ? 'Edit Footer' : 'Create Footer'}
            </Button>
    </div>
      </Card>


      {editing && draftBlock && (
        <div className="fixed inset-0 bg-black/90 z-[999] p-6 overflow-auto flex items-center justify-center">
          <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <DynamicBlockEditor
              block={draftBlock}
              template={template}
              errors={{}}
              colorMode={resolvedColorMode}
              onSave={async (updated: any) => {
                const next: Template =
                  editing === 'header'
                    ? { ...template, headerBlock: updated as any }
                    : { ...template, footerBlock: updated as any };

                onChange(next);
                await onSaveTemplate(next);
                close();
              }}
              onClose={close}
            />
          </div>
        </div>
      )}
    </div>
  );
}
