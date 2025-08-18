// lib/blocks.ts
import type { Block, BlockWithId } from '@/types/blocks';
import { normalizeBlock } from '@/types/blocks';

export function createFallbackBlock(type: Block['type'] = 'text'): BlockWithId {
  switch (type) {
    case 'text':
      return normalizeBlock({
        type: 'text',
        content: { value: 'Nested block...' },
      });
    case 'quote':
      return normalizeBlock({
        type: 'quote',
        content: { text: 'Placeholder quote' },
      });
    case 'button':
      return normalizeBlock({
        type: 'button',
        content: { label: 'Click me', href: '#' },
      });
    case 'contact_form':
      return normalizeBlock({
        type: 'contact_form',
        content: { title: 'Contact Us', notification_email: 'sandon@pointsevenstudio.com' },
      });
    // Add more defaults as needed
    default:
      return normalizeBlock({
        type: 'text',
        content: { value: `Unsupported block type: ${type}` },
      });
  }
}
