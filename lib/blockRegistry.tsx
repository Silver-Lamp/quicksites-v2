// lib/blockRegistry.ts
import type { JSX } from 'react';
import type { BlockType, BlockCategory } from '@/types/blocks';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';
import { validateBlockSchemaCoverage } from '@/lib/blocks/validateBlockSchemaCoverage';

type BlockRenderer = (props: any) => JSX.Element | null;
type LazyRenderer = () => Promise<{ default: BlockRenderer }>;

type DefaultContentMap = typeof DEFAULT_BLOCK_CONTENT;

type BlockRegistryEntry<K extends BlockType = BlockType> = {
  label: string;
  icon: string;
  category: BlockCategory;
  isStatic?: boolean;
  defaultContent: DefaultContentMap[K];
  render: BlockRenderer | LazyRenderer;
};

// Helper to type dynamic imports as LazyRenderer
function lazyRenderer<T extends { default: any }>(
  load: () => Promise<T>
): LazyRenderer {
  return () =>
    load().then((m) => ({
      // ensure it's typed as a component that returns JSX or null
      default: (m.default ?? m) as BlockRenderer,
    }));
}

export const BLOCK_REGISTRY: { [K in BlockType]: BlockRegistryEntry<K> } = {
  text: {
    label: 'Text',
    icon: '📝',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.text,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/text')),
  },
  image: {
    label: 'Image',
    icon: '🖼️',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.image,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/image')),
  },
  video: {
    label: 'Video',
    icon: '🎥',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.video,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/video')),
  },
  audio: {
    label: 'Audio',
    icon: '🎧',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.audio,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/audio')),
  },
  quote: {
    label: 'Quote',
    icon: '❝',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.quote,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/quote')),
  },
  button: {
    label: 'Button',
    icon: '🔘',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.button,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/button')),
  },
  grid: {
    label: 'Grid Layout',
    icon: '🔲',
    category: 'layout',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.grid,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/grid')),
  },
  hero: {
    label: 'Hero Section',
    icon: '🌄',
    category: 'layout',
    isStatic: true,
    defaultContent: DEFAULT_BLOCK_CONTENT.hero,
    // keep this one eagerly loaded if you prefer
    render: HeroRender as BlockRenderer,
  },
  services: {
    label: 'Services List',
    icon: '🛠️',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.services,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/services')),
  },
  faq: {
    label: 'FAQs',
    icon: '❓',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.faq,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/faq')),
  },
  cta: {
    label: 'Call to Action',
    icon: '📣',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.cta,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/cta')),
  },  
  testimonial: {
    label: 'Testimonials',
    icon: '💬',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.testimonial,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/testimonial')),
  },
  footer: {
    label: 'Footer',
    icon: '⬇️',
    category: 'meta',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.footer,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/footer')),
  },
  service_areas: {
    label: 'Service Areas',
    icon: '📍',
    category: 'meta',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.service_areas,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/service-areas')),
  },
  header: {
    label: 'Header',
    icon: '⬆️',
    category: 'meta',
    isStatic: true,
    defaultContent: DEFAULT_BLOCK_CONTENT.header,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/header')),
  },
  contact_form: {
    label: 'Contact Form',
    icon: '📩',
    category: 'interactive',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.contact_form,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/contact-form')),
  },
  chef_profile: {
    label: 'Chef Profile',
    icon: '👨‍🍳',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.chef_profile,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/chef-profile')),
  },
  meals_grid: {
    label: 'Meals Grid',
    icon: '🍱',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.meals_grid,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/meals-grid')),
  }, 
  reviews_list: {
    label: 'Reviews List',
    icon: '⭐',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.reviews_list,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/reviews-list')),
  },
  meal_card: {
    label: 'Meal Card',
    icon: '🍽️',
    category: 'content',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.meal_card,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/meal-card')),
  },
};

// ---- client placeholders for blocks that don't yet have a client wrapper
const clientPlaceholder = (label: string) => async () => ({
    default: (props: any) => (
      <div className="border rounded-md p-3 bg-amber-50 text-sm">
        <b>{label}</b> — editor preview coming soon.
      </div>
    ),
  });

// Client loaders for the editor (used by the client-only RenderBlock)
// NOTE: only point at *.client.tsx files here; everything else uses a placeholder.
export const DYNAMIC_RENDERERS: Partial<Record<BlockType, () => Promise<{ default: any }>>> = {
    // client wrappers (data-fetching)
    meal_card:    () => import('@/components/admin/templates/render-blocks/meal-card.client'),
    reviews_list: () => import('@/components/admin/templates/render-blocks/reviews-list.client'),
    meals_grid:   () => import('@/components/admin/templates/render-blocks/meals-grid.client'),
    // simple blocks (now client components)
    image:         () => import('@/components/admin/templates/render-blocks/image'),
    grid:          () => import('@/components/admin/templates/render-blocks/grid'),
    quote:         () => import('@/components/admin/templates/render-blocks/quote'),
    button:        () => import('@/components/admin/templates/render-blocks/button'),
    services:      () => import('@/components/admin/templates/render-blocks/services'),
    cta:           () => import('@/components/admin/templates/render-blocks/cta'),
    service_areas: () => import('@/components/admin/templates/render-blocks/service-areas'),
    audio:         () => import('@/components/admin/templates/render-blocks/audio'),
    video:         () => import('@/components/admin/templates/render-blocks/video'),
    footer:        () => import('@/components/admin/templates/render-blocks/footer'),
    header:        () => import('@/components/admin/templates/render-blocks/header'),
    faq:           () => import('@/components/admin/templates/render-blocks/faq'),
    testimonial:   () => import('@/components/admin/templates/render-blocks/testimonial'),
    contact_form:  () => import('@/components/admin/templates/render-blocks/contact-form'),
    // keep chef_profile as a client wrapper if it fetches data
    chef_profile:  () => import('@/components/admin/templates/render-blocks/chef-profile.client'),
    // hero + text are handled by STATIC_RENDERERS in the client renderer
  };

if (process.env.NODE_ENV === 'development') {
  validateBlockSchemaCoverage();
}
