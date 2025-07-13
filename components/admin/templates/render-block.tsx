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

export default function RenderBlock({
  block,
  handleNestedBlockUpdate,
}: {
  block: Block;
  handleNestedBlockUpdate?: (updated: Block) => void;
}) {
  const LazyBlock = dynamic(BLOCK_RENDERERS[block.type] ?? fallbackRenderer(block), {
    loading: () => (
      <div className="mb-4 text-gray-500 dark:text-gray-400 italic animate-pulse">
        Loading block: {block.type}...
      </div>
    ),
    ssr: false,
  });

  // Inject blob-safe fallback for hero block image
  const content =
    block.type === 'hero' && typeof block.content === 'object'
      ? {
          ...block.content,
          image_url: block.content.image_url?.startsWith('blob:')
            ? undefined
            : block.content.image_url,
        }
      : block.content;

  const props =
    block.type === 'grid'
      ? { content, handleNestedBlockUpdate, parentBlock: block }
      : { content };

  return <LazyBlock {...props} />;
}

function fallbackRenderer(block: Block) {
  return () =>
    Promise.resolve({
      default: () => <FallbackRenderer block={block} />,
    });
}
