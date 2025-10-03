// lib/blockRegistry.ts
//
// Registry wrapper that: (1) resolves aliases, (2) validates against the
// canonical Zod schemas, (3) exposes block factories for default/seeded
// content, and (4) keeps your lazy renderers + default content.

import type { JSX } from 'react';
import * as React from 'react';
import { z } from 'zod';
import type { Block, BlockType, BlockCategory, SeedContext, BlockDefinition } from '@/types/blocks';
import { isBlockType, schemaFor } from '@/types/blocks';

import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';
import { validateBlockSchemaCoverage } from '@/lib/blocks/validateBlockSchemaCoverage';

// ---------- Renderer typing utilities ----------
type BlockRenderer = (props: any) => JSX.Element | null;
type LazyRenderer = () => Promise<{ default: BlockRenderer }>;

function lazyRenderer<T extends { default: any }>(load: () => Promise<T>): LazyRenderer {
  return () => load().then((m) => ({ default: (m.default ?? m) as BlockRenderer }));
}

/** Heuristic to decide if we're rendering on the public site vs editor. */
function isLiveSite(props: any) {
  return !!(
    props?.renderContext === 'site' ||
    props?.__site ||
    props?.site ||
    props?.publicRender ||
    props?.isLiveSite ||
    (props?.template && (props.template as any).is_site === true)
  );
}

// ---------- Aliases (legacy → canonical) ----------
export const BLOCK_ALIASES: Record<string, BlockType> = {
  services_grid: 'services',
  about: 'text',
  // commerce
  products: 'products_grid',
  product_grid: 'products_grid',
  product_list: 'products_grid',
  service: 'service_offer',
  // scheduler
  'service-scheduler': 'scheduler',
};

// ---------- Block registry entry ----------
type DefaultContentMap = typeof DEFAULT_BLOCK_CONTENT;
type BlockRegistryEntry<K extends BlockType = BlockType> = {
  label: string;
  icon: string;
  category: BlockCategory;
  isStatic?: boolean;
  defaultContent: DefaultContentMap[K] | unknown;
  render: BlockRenderer | LazyRenderer;
};

function getDefaultContentSafe<T extends BlockType>(type: T, fallback: unknown) {
  return ((DEFAULT_BLOCK_CONTENT as any)[type] ?? fallback) as DefaultContentMap[T] | unknown;
}

// ---------- Canonical UI registry ----------
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
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/chef-profile.client')),
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
  hours: {
    label: 'Hours of Operation',
    icon: '⏰',
    category: 'meta',
    isStatic: false,
    defaultContent: DEFAULT_BLOCK_CONTENT.hours,
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/hours')),
  },

  // ---------- NEW: commerce ----------
  products_grid: {
    label: 'Products Grid',
    icon: '🛒',
    category: 'content',
    isStatic: false,
    defaultContent: getDefaultContentSafe('products_grid' as BlockType, {
      title: 'Featured Products',
      columns: 3,
      productIds: [],
    }),
    render: lazyRenderer(() => import('@/components/admin/templates/render-blocks/products-grid')),
  },
  service_offer: {
    label: 'Service Offer',
    icon: '🛎️',
    category: 'interactive',
    isStatic: false,
    defaultContent: getDefaultContentSafe('service_offer' as BlockType, {
      title: 'Book a Service',
      productId: null,
      showPrice: true,
      description: '',
      cta: 'Book now',
    }),
    render: (async () => ({
      default: () => (
        <div className="border rounded-md p-3 bg-amber-50 text-sm">
          <b>Service Offer</b> — renderer coming soon.
        </div>
      ),
    })) as unknown as LazyRenderer,
  },

  // ---------- NEW: scheduler ----------
  scheduler: {
    label: 'Service Scheduler',
    icon: '📅',
    category: 'interactive',
    isStatic: false,
    defaultContent: getDefaultContentSafe('scheduler' as BlockType, {
      title: 'Book an appointment',
      subtitle: 'Choose a time that works for you',
      service_ids: [],
      show_resource_picker: false,
      timezone: 'America/Los_Angeles',
      slot_granularity_minutes: 30,
      lead_time_minutes: 120,
      window_days: 14,
      confirmation_message: 'Thanks! Your appointment is confirmed.',
    }),
    render: async () => {
      const [AdminPreview, SiteLive] = await Promise.all([
        import('@/components/admin/templates/render-blocks/scheduler'),
        import('@/components/sites/render-blocks/scheduler'),
      ]);
      return {
        default: (props: any) => {
          const live = isLiveSite(props);
          const Comp: any = live ? SiteLive.default : AdminPreview.default;
          return <Comp {...props} previewOnly={!live} />;
        },
      };
    },
  },
};

// ---------- Client-only dynamic list (if you use it elsewhere) ----------
const clientPlaceholder = (label: string) => async () => ({
  default: () => (
    <div className="border rounded-md p-3 bg-amber-50 text-sm">
      <b>{label}</b> — editor preview coming soon.
    </div>
  ),
});

export const DYNAMIC_RENDERERS: Partial<Record<BlockType, () => Promise<{ default: any }>>> = {
  meal_card:    () => import('@/components/admin/templates/render-blocks/meal-card.client'),
  reviews_list: () => import('@/components/admin/templates/render-blocks/reviews-list.client'),
  meals_grid:   () => import('@/components/admin/templates/render-blocks/meals-grid.client'),

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
  chef_profile:  () => import('@/components/admin/templates/render-blocks/chef-profile.client'),
  hours:         () => import('@/components/admin/templates/render-blocks/hours'),

  // NEW:
  products_grid: () => import('@/components/admin/templates/render-blocks/products-grid'),
  scheduler:     async () => {
    const [AdminPreview, SiteLive] = await Promise.all([
      import('@/components/admin/templates/render-blocks/scheduler'),
      import('@/components/sites/render-blocks/scheduler'),
    ]);
    return {
      default: (props: any) => {
        const live = isLiveSite(props);
        const Comp: any = live ? SiteLive.default : AdminPreview.default;
        return <Comp {...props} previewOnly={!live} />;
      },
    };
  },
  service_offer: clientPlaceholder('Service Offer'),
};

// ---------- Validation coverage in dev ----------
if (process.env.NODE_ENV === 'development') {
  validateBlockSchemaCoverage();
}

// ---------- Helpers (alias-safe) ----------
function genId() {
  const g: any = globalThis as any;
  return g.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function toCtx(partial?: Partial<SeedContext>): SeedContext {
  const id = () => genId();
  const random = () => Math.random();
  return { id, random, ...(partial ?? {}) } as SeedContext;
}

// Factories (subset kept; extend as needed)
const BLOCK_FACTORIES: Record<string, BlockDefinition['factory']> = {
  services: {
    default: (ctx) =>
      ({
        id: genId(),
        type: 'services',
        version: 1,
        props: {
          title: 'Our Services',
          columns: 3,
          items: (ctx.services?.length
            ? ctx.services
            : [{ name: 'Service A' }, { name: 'Service B' }, { name: 'Service C' }]
          )
            .slice(0, 6)
            .map((s) => ({
              name: s.name,
              description: s.description ?? '',
              price: typeof s.price === 'number' ? `$${s.price}` : s.price,
              href: (s as any).href,
              icon: (s as any).icon,
            })),
        },
      } as unknown as Block),
    seed: (ctx) =>
      ({
        id: genId(),
        type: 'services',
        version: 1,
        props: {
          title: ctx.industry ? `${ctx.industry} Services` : 'Our Services',
          columns: 3,
          items: (ctx.services?.length ? ctx.services : ctx.products ?? [])
            .slice(0, 6)
            .map((p) => ({
              name: p.name,
              description: p.description ?? '',
              price: typeof p.price === 'number' ? `$${p.price}` : (p.price as string | undefined),
              href: (p as any).href,
            })),
        },
      } as unknown as Block),
  },
  products_grid: {
    default: () =>
      ({
        id: genId(),
        type: 'products_grid',
        version: 1,
        props: { title: 'Featured Products', columns: 3, productIds: [], products: [] },
      } as unknown as Block),
  },
  text: {
    seed: (ctx) =>
      ({
        id: genId(),
        type: 'text',
        version: 1,
        props: {
          html:
            `<h2>About ${ctx.merchant?.name ?? 'Us'}</h2>` +
            `<p>${ctx.merchant?.about ??
              `${ctx.merchant?.name ?? 'We'} are your local ${ctx.industry?.toLowerCase?.() ?? 'business'} in ${
                ctx.locale?.city ?? ''
              }${ctx.locale?.region ? ', ' + ctx.locale.region : ctx.locale?.state ? ', ' + ctx.locale.state : ''}.`}</p>`,
        },
      } as unknown as Block),
  },
};

export function resolveCanonicalType(input: string): BlockType | null {
  if (isBlockType(input)) return input;
  const alias = BLOCK_ALIASES[input];
  return alias ?? null;
}

export function getRegistryEntry(inputType: string) {
  const t = resolveCanonicalType(inputType);
  return t ? BLOCK_REGISTRY[t] : undefined;
}

export function validateBlock(block: Block) {
  const t = resolveCanonicalType(block.type);
  if (!t) return { ok: false as const, error: new Error(`Unknown block type "${block.type}"`) };
  const schema = schemaFor(t);
  if (!schema) return { ok: false as const, error: new Error(`No schema for type "${t}"`) };
  const res = (schema as unknown as z.ZodTypeAny).safeParse((block as any).props ?? {});
  return res.success
    ? { ok: true as const, value: { ...block, type: t, props: res.data } as Block }
    : { ok: false as const, error: res.error };
}

export function makeDefaultBlock(inputType: string, ctx?: Partial<SeedContext>): Block | null {
  const t = resolveCanonicalType(inputType);
  if (!t) return null;

  const factory = BLOCK_FACTORIES[t]?.default;
  const base =
    factory?.(toCtx(ctx)) ??
    ({
      id: genId(),
      type: t,
      version: 1,
      props: (DEFAULT_BLOCK_CONTENT as any)[t],
    } as Block);

  const checked = validateBlock(base);
  return checked.ok ? checked.value : base;
}

export function makeSeededBlock(inputType: string, ctx: SeedContext): Block | Block[] | null {
  const t = resolveCanonicalType(inputType);
  if (!t) return null;

  const seed = BLOCK_FACTORIES[t]?.seed;
  if (!seed) return makeDefaultBlock(t, ctx);

  const res = seed(ctx);
  const list = Array.isArray(res) ? res : [res];
  const validated = list.map((b) => (validateBlock(b).ok ? validateBlock(b).value : b));
  return Array.isArray(res) ? validated : validated[0];
}
