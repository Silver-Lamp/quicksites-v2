// lib/create-default-block-RESOLVE-DUP.ts
import type { Block } from '@/types/blocks';

export function createDefaultBlock(type: Block['type']): Block {
  const _id = crypto.randomUUID();

  switch (type) {
    case 'text':
      return { type, _id, content: { value: 'New text block' } };
    case 'image':
      return { type, _id, content: { url: '', alt: 'New image' } };
    case 'video':
      return { type, _id, content: { url: '', caption: 'New video' } };
    case 'audio':
      return { type, _id, content: { url: '', title: 'New audio', provider: 'spotify' } };
    case 'quote':
      return { type, _id, content: { text: 'New quote', attribution: 'Anonymous' } };
    case 'button':
      return { type, _id, content: { label: 'Click me', href: '#', style: 'primary' } };
    case 'grid':
      return {
        type,
        _id,
        content: {
          columns: 2,
          items: [
            createDefaultBlock('text'),
            createDefaultBlock('text'),
          ],
        },
      };
      case 'hero':
        return {
          type: 'hero',
          _id,
          content: {
            title: 'Welcome!',
            description: 'This is a hero block',
            cta_label: 'Learn More',
            cta_link: '#',
          },
        };
      
      case 'services':
        return {
          type: 'services',
          _id,
          content: {
            items: ['Service 1', 'Service 2', 'Service 3'],
          },
        };
      
      case 'cta':
        return {
          type: 'cta',
          _id,
          content: {
            label: 'Call to Action',
            link: '#',
          },
        };
      
      case 'testimonial':
        return {
          type: 'testimonial',
          _id,
          content: {
            quote: 'This product changed my life.',
            attribution: 'Happy User',
          },
        };      
      default:
      return { type: 'text', _id, content: { value: `Unsupported block type: ${type}` } };
  }
}
