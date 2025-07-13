import type { Block } from '@/types/blocks';

export type BlockEditorProps = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
};

// Dynamic imports for all known editors
export const BLOCK_EDITORS: Record<
  Block['type'],
  () => Promise<{ default: React.FC<BlockEditorProps> }>
> = {
  text: () => import('./text-editor'),
  image: () => import('./image-editor'),
  video: () => import('./video-editor'),
  audio: () => import('./audio-editor'),
  quote: () => import('./quote-editor'),
  button: () => import('./button-editor'),
  grid: () => import('./json-fallback-editor'),
  hero: () => import('./hero-editor'),
  services: () => import('./services-editor'),
  testimonial: () => import('./testimonial-editor'),
  cta: () => import('./cta-editor'),
  footer: () => import('./footer-editor'),
};

// Optional preload function for key editors
export function preloadBlockEditor(type: Block['type']) {
  if (type in BLOCK_EDITORS) {
    void BLOCK_EDITORS[type]();
  }
}

// Preload these ahead of time if common
export const preloadCommonEditors = () => {
  preloadBlockEditor('hero');
  preloadBlockEditor('text');
  preloadBlockEditor('cta');
};
