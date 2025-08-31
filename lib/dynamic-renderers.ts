// lib/renderers/dynamic-renderers.ts
import dynamic from 'next/dynamic';

export const DYNAMIC_RENDERERS: Record<string, any> = {
  text: dynamic(() => import('@/components/admin/templates/render-blocks/text'), { ssr: false }),
  image: dynamic(() => import('@/components/admin/templates/render-blocks/image'), { ssr: false }),
  header: dynamic(() => import('@/components/admin/templates/render-blocks/header'), { ssr: false }),
  testimonial: dynamic(() => import('@/components/admin/templates/render-blocks/testimonial'), { ssr: false }),
  faq: dynamic(() => import('@/components/admin/templates/render-blocks/faq'), { ssr: false }),
  contact_form: dynamic(() => import('@/components/admin/templates/render-blocks/contact-form'), { ssr: false }),
  video: dynamic(() => import('@/components/admin/templates/render-blocks/video'), { ssr: false }),
  footer: dynamic(() => import('@/components/admin/templates/render-blocks/footer'), { ssr: false }),
  service_areas: dynamic(() => import('@/components/admin/templates/render-blocks/service-areas'), { ssr: false }),
  hero: dynamic(() => import('@/components/admin/templates/render-blocks/hero'), { ssr: false }),
  services: dynamic(() => import('@/components/admin/templates/render-blocks/services'), { ssr: false }),
  cta: dynamic(() => import('@/components/admin/templates/render-blocks/cta'), { ssr: false }),
  audio: dynamic(() => import('@/components/admin/templates/render-blocks/audio'), { ssr: false }),
  quote: dynamic(() => import('@/components/admin/templates/render-blocks/quote'), { ssr: false }),
  button: dynamic(() => import('@/components/admin/templates/render-blocks/button'), { ssr: false }),
  grid: dynamic(() => import('@/components/admin/templates/render-blocks/grid'), { ssr: false }),
  chef_profile: dynamic(() => import('@/components/admin/templates/render-blocks/chef-profile.client'), { ssr: false }),
  meal_card: dynamic(() => import('@/components/admin/templates/render-blocks/meal-card'), { ssr: false }),
  meals_grid: dynamic(() => import('@/components/admin/templates/render-blocks/meals-grid'), { ssr: false }),
  reviews_list: dynamic(() => import('@/components/admin/templates/render-blocks/reviews-list.client'), { ssr: false }),
};
