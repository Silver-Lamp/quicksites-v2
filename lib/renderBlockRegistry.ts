// lib/renderBlockRegistry.ts
import * as React from 'react';
import type { JSX } from 'react';
import type { BlockType } from '@/types/blocks';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { resolveCanonicalType } from '@/lib/blockRegistry.core';

type BlockRenderer = (props: any) => JSX.Element | null;

const LOCAL_ALIASES: Record<string, BlockType | string> = {
  exterior_agency: 'exterior_agency',
  exterior_cleaning_agency: 'exterior_agency',
  'exterior-cleaning-agency': 'exterior_agency',
  pnw_prestige: 'exterior_agency',
};

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

export const STATIC_RENDERERS: Partial<Record<BlockType, BlockRenderer>> = {
  hero: HeroRender,
};

/** one loader reused for all three keys */
const loadExteriorAgency = () =>
  import('@/components/sites/render-blocks/exterior-cleaning-agency').then((mod) => ({
    default: (props: any) =>
      React.createElement((mod as any).default, {
        content: props?.content ?? props,
      }),
  }));

export const DYNAMIC_RENDERERS: Record<
  Exclude<BlockType, keyof typeof STATIC_RENDERERS>,
  () => Promise<{ default: BlockRenderer }>
> = {
  /** 🔑 register canonical + aliases */
  exterior_agency: loadExteriorAgency,
  exterior_cleaning_agency: loadExteriorAgency,
  pnw_prestige: loadExteriorAgency,

  text:   () => import('@/components/admin/templates/render-blocks/text'),
  image:  () => import('@/components/admin/templates/render-blocks/image'),
  video:  () => import('@/components/admin/templates/render-blocks/video'),
  audio:  () => import('@/components/admin/templates/render-blocks/audio'),
  quote:  () => import('@/components/admin/templates/render-blocks/quote'),
  button: () => import('@/components/admin/templates/render-blocks/button'),
  grid:   () => import('@/components/admin/templates/render-blocks/grid'),
  services: () =>
    import('@/components/admin/templates/render-blocks/services').then((mod) => ({
      default: (props: any) =>
        React.createElement(mod.default as any, {
          ...props,
          services: props?.services ?? props?.template?.services ?? [],
        }),
    })),
  cta:          () => import('@/components/admin/templates/render-blocks/cta'),
  testimonial:  () => import('@/components/admin/templates/render-blocks/testimonial'),
  footer:       () => import('@/components/admin/templates/render-blocks/footer'),
  service_areas:() => import('@/components/admin/templates/render-blocks/service-areas'),
  header:       () => import('@/components/admin/templates/render-blocks/header'),
  faq:          () => import('@/components/admin/templates/render-blocks/faq'),
  contact_form: () => import('@/components/admin/templates/render-blocks/contact-form'),
  hours:        () => import('@/components/admin/templates/render-blocks/hours'),
  chef_profile:  () => import('@/components/admin/templates/render-blocks/chef-profile.client'),
  meals_grid:    () => import('@/components/admin/templates/render-blocks/meals-grid.client'),
  reviews_list:  () => import('@/components/admin/templates/render-blocks/reviews-list.client'),
  meal_card:     () => import('@/components/admin/templates/render-blocks/meal-card.client'),
  products_grid: () => import('@/components/admin/templates/render-blocks/products-grid'),
  service_offer: async () => ({
    default: () =>
      React.createElement(
        'div',
        { className: 'border rounded-md p-3 bg-amber-50 text-sm' },
        React.createElement('b', null, 'Service Offer'),
        ' — renderer coming soon.'
      ),
  }),
  scheduler: async () => {
    const [AdminPreview, SiteLive] = await Promise.all([
      import('@/components/admin/templates/render-blocks/scheduler'),
      import('@/components/sites/render-blocks/scheduler'),
    ]);
    return {
      default: (props: any) => {
        const live = isLiveSite(props);
        const Comp: any = live ? SiteLive.default : AdminPreview.default;
        return React.createElement(Comp, { ...props, previewOnly: !live });
      },
    };
  },
} as const;

/** Resolve alias → canonical */
export function resolveRendererType(input: string): BlockType | null {
  const pre = (LOCAL_ALIASES[input] as string) ?? input;
  const t = resolveCanonicalType(pre);
  return t ?? (pre === 'exterior_agency' ? ('exterior_agency' as BlockType) : null);
}

export function getStaticRenderer(input: string): BlockRenderer | undefined {
  const t = resolveRendererType(input);
  return t ? STATIC_RENDERERS[t] : undefined;
}
export function getDynamicRenderer(
  input: string
): (() => Promise<{ default: BlockRenderer }>) | undefined {
  const t = resolveRendererType(input);
  if (!t) return undefined;
  if (t in STATIC_RENDERERS) return undefined;
  return (DYNAMIC_RENDERERS as any)[t];
}
export async function loadRenderer(
  input: string
): Promise<{ default: BlockRenderer } | null> {
  const s = getStaticRenderer(input);
  if (s) return { default: s };
  const d = getDynamicRenderer(input);
  if (!d) return null;
  return d();
}
