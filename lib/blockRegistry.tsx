// lib/blockRegistry.ts
//
// Registry wrapper that: (1) resolves aliases, (2) validates against the
// canonical Zod schemas, (3) exposes block factories for default/seeded
// content, and (4) keeps your lazy renderers + default content.
//
// Drop-in replacement for your existing file.

import type { JSX } from 'react';
import { z } from 'zod';
import type { Block, BlockType, BlockCategory, SeedContext, BlockDefinition } from '@/types/blocks';
import { isBlockType, schemaFor } from '@/types/blocks';

import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';
import { validateBlockSchemaCoverage } from '@/lib/blocks/validateBlockSchemaCoverage';

// ---------- Renderer typing utilities ----------

type BlockRenderer = (props: any) => JSX.Element | null;
type LazyRenderer = () => Promise<{ default: BlockRenderer }>;

function lazyRenderer<T extends { default: any }>(
  load: () => Promise<T>
): LazyRenderer {
  return () =>
    load().then((m) => ({
      default: (m.default ?? m) as BlockRenderer,
    }));
}

// ---------- Aliases (legacy → canonical) ----------
//
// Add legacy names you want to accept from older seeds.
// Example: seeder produced `services_grid` but canonical is `services`.
export const BLOCK_ALIASES: Record<string, BlockType> = {
  services_grid: 'services',
  // TEMP: Treat 'about' as text until a dedicated 'about' schema/renderer is added.
  about: 'text',
};

// ---------- Block registry entry (UI+default content) ----------

type DefaultContentMap = typeof DEFAULT_BLOCK_CONTENT;
type BlockRegistryEntry<K extends BlockType = BlockType> = {
  label: string;
  icon: string;
  category: BlockCategory;
  isStatic?: boolean;
  defaultContent: DefaultContentMap[K];
  render: BlockRenderer | LazyRenderer;
};

// ---------- Canonical UI registry (unchanged labels/icons; still lazy) ----------

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
    render: HeroRender as BlockRenderer, // eagerly loaded
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
};

// ---------- Client-only wrappers for the editor preview ----------

const clientPlaceholder = (label: string) => async () => ({
  default: (props: any) => (
    <div className="border rounded-md p-3 bg-amber-50 text-sm">
      <b>{label}</b> — editor preview coming soon.
    </div>
  ),
});

// Only reference *.client.tsx here.
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

  // hero + text are handled by STATIC_RENDERERS elsewhere if you have them
  hours: () => import('@/components/admin/templates/render-blocks/hours'),
};

// ---------- Small “API layer” on top of the registry ----------

/** Create a UUID safely in browser/server */
function genId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  return g.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/** Resolve canonical type from an input that may be a legacy alias */
export function resolveCanonicalType(input: string): BlockType | null {
  if (isBlockType(input)) return input;
  const alias = BLOCK_ALIASES[input];
  return alias ?? null;
}

/** Return the UI registry entry (after resolving alias). */
export function getRegistryEntry(inputType: string) {
  const t = resolveCanonicalType(inputType);
  return t ? BLOCK_REGISTRY[t] : undefined;
}

/** Validate a block’s props against the canonical Zod schema (post-alias). */
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

// ---------- Per-type factory hooks (Optional, extend anytime) ----------
//
// If a type isn’t listed here, we’ll fall back to DEFAULT_BLOCK_CONTENT.
const BLOCK_FACTORIES: Record<
  string,
  BlockDefinition['factory']
> = {
  // Canonical 'services' (covers legacy 'services_grid' via alias)
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
              href: s.href,
              icon: s.icon,
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

  // TEMP: 'about' alias maps to 'text' → create a nice About paragraph as text content.
  // When you add a real 'about' block/schema, drop this and register a proper def.
  text: {
    seed: (ctx) =>
      ({
        id: genId(),
        type: 'text',
        version: 1,
        props: {
          // shape should match your text schema (e.g., { html } or { markdown })
          html:
            `<h2>About ${ctx.merchant?.name ?? 'Us'}</h2>` +
            `<p>${ctx.merchant?.about ??
              `${ctx.merchant?.name ?? 'We'} are your local ${ctx.industry?.toLowerCase?.() ?? 'business'} in ${
                ctx.locale?.city ?? ''
              }${ctx.locale?.region ? ', ' + ctx.locale.region : ctx.locale?.state ? ', ' + ctx.locale.state : ''}.`
            }</p>`,
        },
      } as unknown as Block),
  },
};

/** Construct a block with default content (alias-safe). */
export function makeDefaultBlock(inputType: string, ctx?: Partial<SeedContext>): Block | null {
  const t = resolveCanonicalType(inputType);
  if (!t) return null;

  // Use a specific default factory if provided; otherwise use DEFAULT_BLOCK_CONTENT.
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
  return checked.ok ? checked.value : base; // return unparsed if schema complains in dev
}

/** Construct block(s) from merchant/services data (alias-safe). */
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

// ---------- Tiny ctx helper ----------

function toCtx(partial?: Partial<SeedContext>): SeedContext {
  const id = () => genId();
  const random = () => Math.random();
  return { id, random, ...(partial ?? {}) } as SeedContext;
}

// ---------- Dev-time coverage check ----------

if (process.env.NODE_ENV === 'development') {
  validateBlockSchemaCoverage();
}
