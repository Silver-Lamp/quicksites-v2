import type { Block } from '@/types/blocks';

export function suggestFix(block: Block): Partial<Block['content']> {
  const { type, content } = block;

  switch (type) {
    case 'hero':
      return {
        headline: content?.headline || 'Your Trusted Local Towing Partner',
        subheadline: content?.subheadline || 'Fast. Reliable. 24/7 Service.',
        cta_text: content?.cta_text || 'Call Now',
        cta_link: content?.cta_link || 'tel:+11234567890',
      };
    case 'cta':
      return {
        label: content?.label || 'Get Started',
        link: content?.link || '/contact',
      };
    case 'testimonial':
      return {
        testimonials: content?.testimonials || [{ value: 'Great service at 2am!', attribution: '– Happy Customer' }],
      };
    case 'services':
      return {
        items: content?.items?.length
          ? content.items
          : ['Towing', 'Roadside Assistance', 'Battery Jumpstarts'],
      };
    case 'text':
      return {
        value: content?.value || 'Welcome to our site. We’re here to help.',
      };
    default:
      return {};
  }
}
