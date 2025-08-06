import type { BlockType, BlockCategory, BlockContentMap } from '@/types/blocks';
import type { JSX } from 'react';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';
import { validateBlockSchemaCoverage } from '@/lib/blocks/validateBlockSchemaCoverage';

type BlockRenderer = (props: any) => JSX.Element;

type BlockRegistryEntry = {
  label: string;
  icon: string;
  category: BlockCategory;
  isStatic: boolean;
  defaultContent: typeof BlockContentMap[BlockType];
  render: BlockRenderer | (() => Promise<{ default: BlockRenderer }>);
};

export const BLOCK_REGISTRY: Record<BlockType, BlockRegistryEntry> = {
  text: {
    label: 'Text',
    icon: '📝',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.text,
    render: () => import('@/components/admin/templates/render-blocks/text'),
  },
  image: {
    label: 'Image',
    icon: '🖼️',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.image,
    render: () => import('@/components/admin/templates/render-blocks/image'),
  },
  video: {
    label: 'Video',
    icon: '🎥',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.video,
    render: () => import('@/components/admin/templates/render-blocks/video'),
  },
  audio: {
    label: 'Audio',
    icon: '🎧',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.audio,
    render: () => import('@/components/admin/templates/render-blocks/audio'),
  },
  quote: {
    label: 'Quote',
    icon: '❝',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.quote,
    render: () => import('@/components/admin/templates/render-blocks/quote'),
  },
  button: {
    label: 'Button',
    icon: '🔘',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.button,
    render: () => import('@/components/admin/templates/render-blocks/button'),
  },
  grid: {
    label: 'Grid Layout',
    icon: '🔲',
    category: 'layout',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.grid,
    render: () => import('@/components/admin/templates/render-blocks/grid'),
  },
  hero: {
    label: 'Hero Section',
    icon: '🌄',
    category: 'layout',
    isStatic: true,
    defaultContent: DEFAULT_BLOCK_CONTENT.hero,
    render: HeroRender,
  },
  services: {
    label: 'Services List',
    icon: '🛠️',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.services,
    render: () => import('@/components/admin/templates/render-blocks/services'),
  },
  faq: {
    label: 'FAQs',
    icon: '❓',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.faq,
    render: () => import('@/components/admin/templates/render-blocks/faq'),
  },
  cta: {
    label: 'Call to Action',
    icon: '📣',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.cta,
    render: () => import('@/components/admin/templates/render-blocks/cta'),
  },
  testimonial: {
    label: 'Testimonials',
    icon: '💬',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.testimonial,
    render: () => import('@/components/admin/templates/render-blocks/testimonial'),
  },
  footer: {
    label: 'Footer',
    icon: '⬇️',
    category: 'meta',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.footer,
    render: () => import('@/components/admin/templates/render-blocks/footer'),
  },
  service_areas: {
    label: 'Service Areas',
    icon: '📍',
    category: 'meta',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.service_areas,
    render: () => import('@/components/admin/templates/render-blocks/service-areas'),
  },
  header: {
    label: 'Header',
    icon: '⬆️',
    category: 'meta',
    isStatic: true,
    defaultContent: DEFAULT_BLOCK_CONTENT.header,
    render: () => import('@/components/admin/templates/render-blocks/header'),
  },
  contact_form: {
    label: 'Contact Form',
    icon: '📩',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.contact_form,
    render: () => import('@/components/admin/templates/render-blocks/contact-form'),
  },
  meal_card: {
    label: 'Meal Card',
    icon: '🍽️',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.meal_card,
    render: () => import('@/components/admin/templates/render-blocks/meal-card') as Promise<{ default: BlockRenderer }>,
  },
chef_profile: {
    label: 'Chef Profile',
    icon: '👨‍🍳',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.chef_profile,
    render: () => import('@/components/admin/templates/render-blocks/chef-profile') as Promise<{ default: BlockRenderer }>,
  },
};
if (process.env.NODE_ENV === 'development') {
    validateBlockSchemaCoverage();
  }
  