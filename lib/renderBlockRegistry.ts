// lib/renderBlockRegistry.ts  (works as .ts)
import * as React from 'react';
import type { BlockType } from '@/types/blocks';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import type { JSX } from 'react';

type BlockRenderer = (props: any) => JSX.Element;

export const STATIC_RENDERERS: Partial<Record<BlockType, BlockRenderer>> = {
  hero: HeroRender,
};

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

  // ✅ Inject template.services here
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
} as const;
