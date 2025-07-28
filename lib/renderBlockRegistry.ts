import type { BlockType } from '@/types/blocks';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { JSX } from 'react';

type BlockRenderer = (props: any) => JSX.Element;

export const STATIC_RENDERERS: Partial<Record<BlockType, BlockRenderer>> = {
  hero: HeroRender,
};

// All blocks except statics
export const DYNAMIC_RENDERERS: Record<
  Exclude<BlockType, keyof typeof STATIC_RENDERERS>,
  () => Promise<{ default: BlockRenderer }>
> = {
  text: () => import('@/components/admin/templates/render-blocks/text'),
  image: () => import('@/components/admin/templates/render-blocks/image'),
  video: () => import('@/components/admin/templates/render-blocks/video'),
  audio: () => import('@/components/admin/templates/render-blocks/audio'),
  quote: () => import('@/components/admin/templates/render-blocks/quote'),
  button: () => import('@/components/admin/templates/render-blocks/button'),
  grid: () => import('@/components/admin/templates/render-blocks/grid'),
  services: () => import('@/components/admin/templates/render-blocks/services'),
  cta: () => import('@/components/admin/templates/render-blocks/cta'),
  testimonial: () => import('@/components/admin/templates/render-blocks/testimonial'),
  footer: () => import('@/components/admin/templates/render-blocks/footer'),
  service_areas: () => import('@/components/admin/templates/render-blocks/service-areas'),
  header: () => import('@/components/admin/templates/render-blocks/header'),
  faq: () => import('@/components/admin/templates/render-blocks/faq'),
  contact_form: () => import('@/components/admin/templates/render-blocks/contact-form'),
} as const;
