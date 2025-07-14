'use client';

import type { Block } from '@/types/blocks';
import dynamic from 'next/dynamic';
import { JSX } from 'react';
import FallbackRenderer from '@/lib/ui/fallback-renderer';

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
  const LazyBlock = dynamic(BLOCK_RENDERERS[block.type] ?? fallbackRenderer(block), {
    loading: () => (
      <div className="mb-4 text-gray-500 dark:text-gray-400 italic animate-pulse">
        Loading block: {block.type}...
      </div>
    ),
    ssr: false,
  });

  // Fix for hero blob image preview
  const safeContent =
    block.type === 'hero' && typeof block.content === 'object'
      ? {
          ...block.content,
          image_url: block.content.image_url?.startsWith('blob:')
            ? undefined
            : block.content.image_url,
        }
      : block.content;

  const commonProps = {
    block,
    content: safeContent,
    mode,
    disableInteraction,
    compact,
  };

  // Special case for grid
  if (block.type === 'grid') {
    return (
      <LazyBlock
        {...commonProps}
        handleNestedBlockUpdate={handleNestedBlockUpdate}
        parentBlock={block}
      />
    );
  }

  return <LazyBlock {...commonProps} />;
}

function fallbackRenderer(block: Block) {
  return () =>
    Promise.resolve({
      default: () => <FallbackRenderer block={block} />,
    });
}
