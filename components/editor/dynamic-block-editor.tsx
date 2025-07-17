// components/editor/DynamicBlockEditor.tsx
'use client';

import dynamic from 'next/dynamic';
import { BLOCK_EDITORS } from '@/components/admin/templates/block-editors';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { useEffect, useState } from 'react';
import type { Block } from '@/types/blocks';
import { InlineBlockTypePicker } from './inline-block-type-picker';

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
        const mod = await BLOCK_EDITORS[block.type]();
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
            setShowTypePicker(false);
          }}
        />
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
