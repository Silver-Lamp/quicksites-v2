// components/admin/templates/render-block.tsx
'use client';

import type { Block } from '@/types/blocks';
import { BLOCK_METADATA, BLOCK_TYPES, type BlockType } from '@/types/blocks';
import { JSX } from 'react';
import { useBlockFix } from '@/components/ui/block-fix-context';
import DebugOverlay from '@/components/ui/debug-overlay';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { DYNAMIC_RENDERERS } from '@/lib/dynamic-renderers';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

const STATIC_RENDERERS: Partial<Record<BlockType, (props: any) => JSX.Element>> = {
  hero: HeroRender,
};

function assertAllRenderersCovered() {
  const handled = new Set([
    ...Object.keys(STATIC_RENDERERS),
    ...Object.keys(DYNAMIC_RENDERERS),
  ]);
  const missing = BLOCK_TYPES.filter(type => !handled.has(type));
  if (missing.length > 0) {
    const msg = `[🛑 BLOCK_RENDERERS] Missing renderers for: ${missing.join(', ')}`;
    if (isDev) throw new Error(msg);
    else console.warn(msg);
  }
}

assertAllRenderersCovered();

function resolveRenderer(type: BlockType) {
  if (type in STATIC_RENDERERS) return STATIC_RENDERERS[type as keyof typeof STATIC_RENDERERS];
  if (type in DYNAMIC_RENDERERS) return DYNAMIC_RENDERERS[type];
  return fallbackRenderer(type);
}

type RenderProps = {
  block: Block;
  handleNestedBlockUpdate?: (updated: Block) => void;
  mode?: 'preview' | 'editor';
  disableInteraction?: boolean;
  compact?: boolean;
  previewOnly?: boolean;
  verboseUi?: boolean;
};

export default function RenderBlock({
  block,
  handleNestedBlockUpdate,
  mode = 'preview',
  disableInteraction = false,
  compact = false,
  previewOnly = false,
  verboseUi = isDev,
}: RenderProps) {
  const { enabled: fixEnabled, draftFixes } = useBlockFix();

  if (!block || !block.type) {
    return (
      <div className="text-red-500 text-sm p-2 bg-red-900/10 rounded">
        ⚠️ Invalid block: missing or undefined type
      </div>
    );
  }

  const override = fixEnabled ? draftFixes[block._id || ''] : {};
  const safeContent = { ...block.content, ...override };

  const commonProps = {
    block,
    content: safeContent,
    mode,
    disableInteraction,
    compact,
    previewOnly,
    verboseUi,
  };

  const wrapperProps = {
    'data-block-id': block._id || 'unknown',
    'data-block-type': block.type,
    className: 'relative group',
    ref: (el: HTMLDivElement | null) => {
      if (el) (el as any).__squatterContent = safeContent;
    },
  };

  const debugOverlay = verboseUi ? (
    <DebugOverlay position="bottom-right">
      {`[Block: ${block.type}]
ID: ${block._id || 'n/a'}`}
    </DebugOverlay>
  ) : null;

  const Component = resolveRenderer(block.type);

  return (
    <div {...wrapperProps}>
      {debugOverlay}
      <Component
        {...commonProps as any}
        {...(block.type === 'grid' && handleNestedBlockUpdate
          ? { handleNestedBlockUpdate, parentBlock: block }
          : {})}
      />
    </div>
  );
}

function fallbackRenderer(type: string): () => JSX.Element {
  return () => {
    console.error(`[🛑 fallbackRenderer] No renderer found for "${type}"`);
    return (
      <div className="text-red-500 bg-red-900/10 border border-red-500/30 p-2 rounded text-sm">
        ⚠️ No renderer for block type: <strong>{type}</strong>
      </div>
    );
  };
}
