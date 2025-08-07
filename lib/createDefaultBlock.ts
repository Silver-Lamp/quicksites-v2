// lib/createDefaultBlock.ts
import type { BlockType } from '@/types/blocks';
import { normalizeBlock } from '@/lib/utils/normalizeBlock';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';
import { z } from 'zod';
import { BlockSchema } from '@/admin/lib/zod/blockSchemas';

export function createDefaultBlock(type: BlockType): z.infer<typeof BlockSchema> {
  const _id = crypto.randomUUID();

  let content = DEFAULT_BLOCK_CONTENT[type];

  switch (type) {
    case 'grid':
      content = {
        ...content,
        title: 'Grid',
        subtitle: 'This is a grid block',
        layout: 'grid',
        items: [
          {
            question: 'How fast is your response time?',
            answer: 'Usually within 30 minutes.',
            appearance: 'default',
          },
          {
            question: 'This is a text block',
            answer: 'This is a text block',
            appearance: 'default',
          },
        ],
      };
      break;

    case 'testimonial':
      content = {
        ...content,
        testimonials: [
          {
            quote: 'They did a great job!',
            attribution: 'Happy Client',
            image_url: '',
            rating: 5,
          },
        ],
        layout: 'list',
        randomized: false,
      };
      break;

    case 'faq':
      content = {
        ...content,
        title: 'Frequently Asked Questions',
        subtitle: 'We answer the most common questions.',
        items: [
          { question: 'How fast is your response time?', answer: 'Usually within 30 minutes.', appearance: 'default' },
          { question: 'Do you offer 24/7 towing?', answer: 'Yes, always on call.', appearance: 'default' },
        ],
        layout: 'accordion',
      };
      break;

    case 'chef_profile':
      content = {
        ...content,
        certifications: ['Certification A', 'Certification B'],
        meals: [
          {
            name: 'Meal A',
            description: 'This is a description',
            price: '$10',
            availability: 'Available',
            image_url: 'https://placekitten.com/800/400',
          },
        ],
      };
      break;

    case 'services':
      content = {
        ...content,
        items: ['Towing', 'Jump Starts', 'Battery Replacement'],
        title: 'Our Services',
        subtitle: 'We offer everything from towing to roadside assistance.',
      };
      break;

    case 'header':
      content = {
        ...content,
        logo_url: 'https://placekitten.com/800/400',
        nav_items: [
          { label: 'Home', href: '/', appearance: 'default' },
          { label: 'Services', href: '/services', appearance: 'default' },
          { label: 'Contact', href: '/contact', appearance: 'default' },
        ],
      };
      break;

    case 'footer':
      content = {
        ...content,
        nav_items: [
          { label: 'Home', href: '/', appearance: 'default' },
          { label: 'Towing', href: '/towing', appearance: 'default' },
          { label: 'Contact', href: '/contact', appearance: 'default' },
        ],
      };
      break;

    // Add others as needed
  }

  return normalizeBlock({
    type,
    _id,
    content,
  }) as z.infer<typeof BlockSchema>;
}
