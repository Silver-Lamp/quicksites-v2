// components/admin/templates/create-fallback-block.ts
import type { BlockWithId, Block } from '@/types/blocks';

export function createFallbackBlock(type: Block['type']): BlockWithId {
  const id = crypto.randomUUID?.() || Date.now().toString();

  switch (type) {
    case 'text':
      return {
        _id: id,
        type: 'text',
        content: { value: 'New text block' },
      };
    case 'quote':
      return {
        _id: id,
        type: 'quote',
        content: { text: 'New quote' },
      };
    case 'button':
      return {
        _id: id,
        type: 'button',
        content: { label: 'Click me', href: '#' },
      };
    case 'cta':
      return {
        _id: id,
        type: 'cta',
        content: { label: 'Learn more', link: '#' },
      };
    case 'hero':
      return {
        _id: id,
        type: 'hero',
        content: { title: 'Welcome', description: 'Subtext here' },
      };
    case 'testimonial':
      return {
        _id: id,
        type: 'testimonial',
        content: { quote: 'Great service!' },
      };
    case 'image':
      return {
        _id: id,
        type: 'image',
        content: { url: 'https://placekitten.com/600/300', alt: 'Placeholder image' },
      };
    default:
      return {
        _id: id,
        type: 'text',
        content: { value: 'Unsupported block' },
      };
  }
}