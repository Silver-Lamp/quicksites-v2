'use client';

import type { Block } from '@/types/blocks';
import dynamic from 'next/dynamic';
import { JSX } from 'react';
import FallbackRenderer from '@/lib/ui/fallback-renderer';
import { useBlockFix } from '@/components/ui/block-fix-context';

const BLOCK_RENDERERS: Record<
  Block['type'],
  () => Promise<{ default: (props: any) => JSX.Element }>
> = {
  text: () => import('./render-blocks/text'),
  image: () => import('./render-blocks/image'),
  video: () => import('./render-blocks/video'),
  audio: () => import('./render-blocks/audio'),
  quote: () => import('./render-blocks/quote'),
  button: () => import('./render-blocks/button'),
  grid: () => import('./render-blocks/grid'),
  hero: () => import('./render-blocks/hero'),
  services: () => import('./render-blocks/services'),
  cta: () => import('./render-blocks/cta'),
  testimonial: () => import('./render-blocks/testimonial'),
  footer: () => import('./render-blocks/footer'),
  service_areas: () => import('./render-blocks/service-areas'),
  page_header: () => import('./render-blocks/page-header'),
};

type RenderProps = {
  block: Block;
  handleNestedBlockUpdate?: (updated: Block) => void;
  mode?: 'preview' | 'editor';
  disableInteraction?: boolean;
  compact?: boolean;
};

export default function RenderBlock({
  block,
  handleNestedBlockUpdate,
  mode = 'preview',
  disableInteraction = false,
  compact = false,
}: RenderProps) {
  const { enabled: fixEnabled, draftFixes } = useBlockFix();
  
  if (!block || !block.type) {
    return <div className="text-red-500">⚠️ Invalid block</div>;
  }

  const DynamicBlock = dynamic(
    BLOCK_RENDERERS[block.type] ?? fallbackRenderer(block),
    {
      loading: () => (
        <div className="mb-4 text-gray-500 dark:text-gray-400 italic animate-pulse">
          Loading block: {block.type}...
        </div>
      ),
      ssr: true,
    }
  );

  const override = fixEnabled ? draftFixes[block._id || ''] : {};
  const safeContent = { ...block.content, ...override };

  const commonProps = {
    block,
    content: safeContent,
    mode,
    disableInteraction,
    compact,
  };

  const wrapperProps = {
    'data-block-id': block._id || 'unknown',
    'data-block-type': block.type,
    className: 'relative group',
    ref: (el: HTMLDivElement | null) => {
      if (el) {
        (el as any).__squatterContent = safeContent; // used by SquatBot for patching
      }
    },
  };

  if (block.type === 'grid') {
    return (
      <div {...wrapperProps}>
        <DynamicBlock
          {...commonProps}
          handleNestedBlockUpdate={handleNestedBlockUpdate}
          parentBlock={block}
        />
      </div>
    );
  }

  return (
    <div {...wrapperProps}>
      <DynamicBlock {...commonProps} />
    </div>
  );
}

function fallbackRenderer(block: Block) {
  return () =>
    Promise.resolve({
      default: () => <FallbackRenderer block={block} />,
    });
}
