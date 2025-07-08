// lib/createDefaultBlock.ts
import type { Block } from '@/admin/lib/zod/blockSchema';
import crypto from 'crypto';
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';

export function createDefaultBlock(type: Block['type']): Block {
  const _id = crypto.randomUUID?.() || Date.now().toString();

  switch (type) {
    case 'text':
      return { type, _id, value: { value: 'Sample text block' } };

    case 'image':
      return {
        type,
        _id,
        value: {
          url: 'https://placekitten.com/800/400',
          alt: 'A cute kitten',
        },
      };

    case 'video':
      return {
        type,
        _id,
        value: {
          url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          caption: 'Intro video',
        },
      };

    case 'audio':
      return {
        type,
        _id,
        value: {
          provider: 'spotify',
          url: 'https://spotify.com/sample',
          title: 'Sample Audio',
        },
      };

    case 'quote':
      return {
        type,
        _id,
        value: {
          text: 'This changed everything.',
          author: 'Jane Doe',
        },
      };

    case 'button':
      return {
        type,
        _id,
        value: {
          label: 'Click Me',
          href: '#',
          style: 'primary',
        },
      };

    case 'hero':
      return {
        type,
        _id,
        value: {
          title: 'Welcome to Your Site!',
          description: 'This is the hero section.',
          cta_label: 'Get Started',
          cta_link: '#',
        },
      };

    case 'services':
      return {
        type,
        _id,
        value: {
          items: ['Service A', 'Service B', 'Service C'],
        },
      };

    case 'testimonial':
      return {
        type,
        _id,
        value: {
          quote: 'They did a great job!',
          attribution: 'Happy Client',
        },
      };

    case 'cta':
      return {
        type,
        _id,
        value: {
          label: 'Learn More',
          link: '#about',
        },
      };

    case 'grid':
      return {
        type,
        _id,
        value: {
          columns: 2,
          items: [
            createDefaultBlock('text'),
            createDefaultBlock('image'),
          ],
        },
      };

    default:
      return {
        type: 'text',
        _id,
        value: { value: `Unsupported block type: ${type}` },
      };
  }
}
