import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

export type BlockEditorProps = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
  errors?: Record<string, BlockValidationError[]>;
  template?: Template;
};

// 🌐 Mapping of block type → dynamic React component import
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
  grid: () => import('./json-fallback-editor'), // uses JSON fallback
  hero: () => import('./hero-editor'),
  services: () => import('./services-editor'),
  testimonial: () => import('./testimonial-editor'),
  cta: () => import('./cta-editor'),
  footer: () => import('./footer-editor'),
};

// 🧠 Optional preloader for a single block type (for speed optimization)
export function preloadBlockEditor(type: Block['type']) {
  if (type in BLOCK_EDITORS) {
    void BLOCK_EDITORS[type]();
  }
}

// ⚡ Preload most-used editors (optional: call early in app)
export function preloadCommonEditors() {
  preloadBlockEditor('hero');
  preloadBlockEditor('text');
  preloadBlockEditor('cta');
}
