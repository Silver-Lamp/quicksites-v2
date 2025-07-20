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
      content: { headline: 'Welcome!', subheadline: 'This is your hero block.' },
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
      content: { testimonials: [{ quote: 'They did a great job!', attribution: 'John Doe' }] },
    }),
  },
  {
    type: 'service_areas',
    label: 'Service Areas',
    icon: '🌍',
    tags: ['location'],
    generate: () => ({
      _id: crypto.randomUUID(),
      type: 'service_areas',
      content: {
        title: 'Our Service Areas',
        subtitle: 'We proudly serve the surrounding towns and cities within 30 miles.',
        cities: [],
        allCities: [],
        sourceLat: 43.3242,
        sourceLng: -88.0899,
      },
    }),
  },
];