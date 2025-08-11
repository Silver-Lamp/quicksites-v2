// lib/createDefaultBlock.ts
import type { BlockType } from '@/types/blocks';
import { normalizeBlock } from '@/lib/utils/normalizeBlock';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';
import { z } from 'zod';
import { BlockSchema } from '@/admin/lib/zod/blockSchema';

const clone = <T,>(v: T): T =>
  typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));

export function createDefaultBlock(type: BlockType): z.infer<typeof BlockSchema> {
  const _id = crypto.randomUUID();

  // Start from a fresh copy so we never mutate the shared defaults.
  // Use `any` here to avoid union-literal fights across block shapes.
  const base: any = clone(DEFAULT_BLOCK_CONTENT[type]);
  let content: any = base;

  switch (type) {
    case 'grid': {
      content = {
        ...base,
        title: 'Grid',
        subtitle: 'This is a grid block',
        layout: 'grid',
        items: [
          {
            type: 'text',
            _id: crypto.randomUUID(),
            content: { value: 'How fast is your response time? Usually within 30 minutes.' },
          },
          {
            type: 'text',
            _id: crypto.randomUUID(),
            content: { value: 'This is a second text block inside the grid.' },
          },
        ],
      };
      break;
    }

    case 'testimonial': {
      content = {
        ...content,
        testimonials: [
          {
            quote: 'They did a great job!',
            attribution: 'Happy Client',
            avatar_url: 'https://placehold.co/96x96',
            rating: 5,
          },
        ],
        randomized: false,
      };
      break;
    }
    
    case 'faq': {
      content = {
        ...base,
        title: 'Frequently Asked Questions',
        items: [
          { question: 'How fast is your response time?', answer: 'Usually within 30 minutes.' },
          { question: 'Do you offer 24/7 towing?', answer: 'Yes, always on call.' },
        ],
      };
      break;
    }

    case 'chef_profile': {
      content = {
        ...base,
        certifications: ['Certification A', 'Certification B'],
        meals: [
          {
            id: crypto.randomUUID(),
            name: 'Meal A',
            description: 'This is a description',
            price: '$10',
            availability: 'Available',
            image_url: 'https://placehold.co/800x400',
          },
        ],
      };
      break;
    }

    case 'services': {
      content = { ...base, items: ['Towing', 'Jump Starts', 'Battery Replacement'] };
      break;
    }

    case 'header': {
      content = {
        ...base,
        logo_url: 'https://placehold.co/200x80',
        nav_items: [
          { label: 'Home', href: '/' },
          { label: 'Services', href: '/services' },
          { label: 'Contact', href: '/contact' },
        ],
      };
      break;
    }

    case 'footer': {
      content = {
        ...base,
        links: [
          { label: 'Home', href: '/' },
        ],
        logo_url: 'https://placehold.co/200x80',
      };
      break;
    }

    default:
      // leave `content` as the cloned base
      break;
  }

  return normalizeBlock({ type, _id, content }) as z.infer<typeof BlockSchema>;
}
