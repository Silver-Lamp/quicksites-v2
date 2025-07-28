// components/admin/templates/render-block.tsx
'use client';

import type { Block } from '@/types/blocks';
import { BLOCK_METADATA, BLOCK_TYPES, type BlockType } from '@/types/blocks';
import dynamic from 'next/dynamic';
import { JSX } from 'react';
import FallbackRenderer from '@/lib/ui/fallback-renderer';
import { useBlockFix } from '@/components/ui/block-fix-context';
import DebugOverlay from '@/components/ui/debug-overlay';

import HeroRender from '@/components/admin/templates/render-blocks/hero';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

// Dynamically map renderers based on metadata
const RENDERERS: Record<BlockType, any> = Object.fromEntries(
  BLOCK_METADATA.map(({ type }) => {
    if (type === 'hero') return [type, HeroRender];
    return [type, () => import(`@/components/admin/templates/render-blocks/${type}`)];
  })
) as Record<BlockType, any>;

const STATIC_RENDERERS = Object.fromEntries(
  BLOCK_METADATA.filter(m => m.isStatic).map(m => [m.type, RENDERERS[m.type]])
) as Partial<Record<BlockType, (props: any) => JSX.Element>>;

const DYNAMIC_RENDERERS = Object.fromEntries(
  BLOCK_METADATA.filter(m => !m.isStatic).map(m => [m.type, RENDERERS[m.type]])
) as Record<
  Exclude<BlockType, keyof typeof STATIC_RENDERERS>,
  () => Promise<{ default: (props: any) => JSX.Element }>
>;

function assertAllRenderersCovered() {
  const handled = new Set([...Object.keys(STATIC_RENDERERS), ...Object.keys(DYNAMIC_RENDERERS)]);
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
  if (type in DYNAMIC_RENDERERS) return DYNAMIC_RENDERERS[type as keyof typeof DYNAMIC_RENDERERS];
  return fallbackRenderer({ type } as Block);
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
    return <div className="text-red-500 text-sm p-2 bg-red-900/10 rounded">⚠️ Invalid block: missing or undefined type</div>;
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
      {`[Block: ${block.type}]\nID: ${block._id || 'n/a'}`}
    </DebugOverlay>
  ) : null;

  const renderer = resolveRenderer(block.type);

  if (typeof renderer === 'function' && 'then' in renderer) {
    const DynamicBlock = dynamic(renderer as any, {
      ssr: false,
      loading: () => (
        <div className="relative p-2 text-yellow-400 text-xs italic border border-yellow-500/30 rounded bg-yellow-900/10">
          <div>🌀 Loading block: <strong>{block.type}</strong></div>
          <div className="mt-1 opacity-70">ID: {block._id || 'n/a'}</div>
          <div className="mt-1 text-yellow-300">Dynamic import might be stuck.</div>
          <div className="mt-1 text-yellow-400">
            Check path: <code className="font-mono">{`render-blocks/${block.type}`}</code>
          </div>
        </div>
      ),
    });

    if (block.type === 'grid') {
      return (
        <div {...wrapperProps}>
          {debugOverlay}
          <DynamicBlock
            {...commonProps as any}
            handleNestedBlockUpdate={handleNestedBlockUpdate as any}
            parentBlock={block}
          />
        </div>
      );
    }

    return (
      <div {...wrapperProps}>
        {debugOverlay}
        <DynamicBlock {...commonProps as any} />
      </div>
    );
  }

  const StaticComponent = renderer as (props: any) => JSX.Element;
  return (
    <div {...wrapperProps}>
      {debugOverlay}
      <StaticComponent {...commonProps} />
    </div>
  );
}

function fallbackRenderer(block: Block) {
  return () =>
    Promise.resolve({
      default: () => {
        console.error(`[🛑 fallbackRenderer] No renderer found for "${block.type}".`, block);
        return (
          <div className="text-red-500 bg-red-900/10 border border-red-500/30 p-2 rounded text-sm">
            ⚠️ No renderer for block type: <strong>{block.type}</strong>
          </div>
        );
      },
    });
}
