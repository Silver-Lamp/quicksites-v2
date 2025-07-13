import type { BlockWithId, Block } from '@/types/blocks';

export const blockPresets: {
  type: Block['type'];
  label: string;
  icon: string;
  tags: string[];
  generate: () => BlockWithId;
}[] = [
  {
    type: 'text',
    label: 'Text',
    icon: '📝',
    tags: ['content'],
    generate: () => ({
      _id: crypto.randomUUID(),
      type: 'text',
      content: { value: 'Sample text block' },
    }),
  },
  {
    type: 'quote',
    label: 'Quote',
    icon: '❝',
    tags: ['content'],
    generate: () => ({
      _id: crypto.randomUUID(),
      type: 'quote',
      content: { text: 'This changed everything.' },
    }),
  },
  {
    type: 'button',
    label: 'Button',
    icon: '🔘',
    tags: ['action'],
    generate: () => ({
      _id: crypto.randomUUID(),
      type: 'button',
      content: { label: 'Click Me', href: '#' },
    }),
  },
  {
    type: 'hero',
    label: 'Hero',
    icon: '🎯',
    tags: ['layout', 'intro'],
    generate: () => ({
      _id: crypto.randomUUID(),
      type: 'hero',
      content: { title: 'Welcome!', description: 'This is your hero block.' },
    }),
  },
  {
    type: 'cta',
    label: 'Call to Action',
    icon: '🚀',
    tags: ['action'],
    generate: () => ({
      _id: crypto.randomUUID(),
      type: 'cta',
      content: { label: 'Learn More', link: '/about' },
    }),
  },
  {
    type: 'image',
    label: 'Image',
    icon: '🖼️',
    tags: ['visual'],
    generate: () => ({
      _id: crypto.randomUUID(),
      type: 'image',
      content: { url: 'https://placekitten.com/800/400', alt: 'A cute kitten' },
    }),
  },
  {
    type: 'testimonial',
    label: 'Testimonial',
    icon: '💬',
    tags: ['social-proof'],
    generate: () => ({
      _id: crypto.randomUUID(),
      type: 'testimonial',
      content: { quote: 'They did a great job!' },
    }),
  },
];