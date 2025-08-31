// lib/renderBlockRegistry.ts  (works as .ts)
import * as React from 'react';
import type { JSX } from 'react';
import type { BlockType } from '@/types/blocks';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { resolveCanonicalType } from '@/lib/blockRegistry.core';

type BlockRenderer = (props: any) => JSX.Element | null;

// ---- Static renderers (keep eager for critical-above-the-fold) ----
export const STATIC_RENDERERS: Partial<Record<BlockType, BlockRenderer>> = {
  hero: HeroRender,
};

// ---- Dynamic renderers (code-split the rest) ----
export const DYNAMIC_RENDERERS: Record<
  Exclude<BlockType, keyof typeof STATIC_RENDERERS>,
  () => Promise<{ default: BlockRenderer }>
> = {
  text:   () => import('@/components/admin/templates/render-blocks/text'),
  image:  () => import('@/components/admin/templates/render-blocks/image'),
  video:  () => import('@/components/admin/templates/render-blocks/video'),
  audio:  () => import('@/components/admin/templates/render-blocks/audio'),
  quote:  () => import('@/components/admin/templates/render-blocks/quote'),
  button: () => import('@/components/admin/templates/render-blocks/button'),
  grid:   () => import('@/components/admin/templates/render-blocks/grid'),

  // ✅ Inject template.services here (fallback path for older data)
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

  // Optional extras (present in your BlockType union)
  chef_profile:  () => import('@/components/admin/templates/render-blocks/chef-profile.client'),
  meals_grid:    () => import('@/components/admin/templates/render-blocks/meals-grid.client'),
  reviews_list:  () => import('@/components/admin/templates/render-blocks/reviews-list.client'),
  meal_card:     () => import('@/components/admin/templates/render-blocks/meal-card.client'),
} as const;

// ---- Helpers: resolve aliases and load a renderer safely ----

/** Resolve alias → canonical (e.g., "services_grid" → "services", "about" → "text"). */
export function resolveRendererType(input: string): BlockType | null {
  return resolveCanonicalType(input);
}

/** Get a static renderer if one exists (after alias resolution). */
export function getStaticRenderer(input: string): BlockRenderer | undefined {
  const t = resolveRendererType(input);
  return t ? STATIC_RENDERERS[t] : undefined;
}

/** Get a dynamic loader if one exists (after alias resolution). */
export function getDynamicRenderer(
  input: string
): (() => Promise<{ default: BlockRenderer }>) | undefined {
  const t = resolveRendererType(input);
  if (!t) return undefined;
  // TS: key is guaranteed to exist if not static
  if (t in STATIC_RENDERERS) return undefined;
  return (DYNAMIC_RENDERERS as any)[t];
}

/**
 * Convenience helper: load a renderer (static or dynamic) and return a standard shape.
 * Returns null if no renderer is registered (callers can display an UnknownBlock).
 */
export async function loadRenderer(
  input: string
): Promise<{ default: BlockRenderer } | null> {
  const s = getStaticRenderer(input);
  if (s) return { default: s };
  const d = getDynamicRenderer(input);
  if (!d) return null;
  return d();
}
