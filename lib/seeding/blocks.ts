import type { BlockKey } from './types';

// All blocks are returned in *normalized* shape: { type, content, ... }
// so they pass your Zod validators without needing props→content migration.

export function makeHeader(): any {
  return { type: 'header', content: { logo_url: '', nav_items: [] } };
}

export function makeHero(cfg?: Record<string, any>, siteName?: string): any {
  const headline = cfg?.headline || `Welcome to ${siteName || 'Your Site'}`;
  return {
    type: 'hero',
    content: {
      headline,
      subheadline: cfg?.subheadline || 'Start editing, and let the magic happen.',
      cta_text: cfg?.cta_text || 'Get Started',
      cta_link: cfg?.cta_link || '#contact',
      image_url: cfg?.image_url || '',
      layout_mode: cfg?.layout_mode || 'inline',
      image_position: cfg?.image_position || 'center',
      blur_amount: cfg?.blur_amount ?? 0,
      parallax_enabled: cfg?.parallax_enabled ?? false,
      mobile_layout_mode: cfg?.mobile_layout_mode || 'inline',
      mobile_crop_behavior: cfg?.mobile_crop_behavior || 'cover',
    },
  };
}

export function makeServices(serviceNames: string[], cfg?: Record<string, any>): any {
  const items = (serviceNames.length ? serviceNames : ['Service A','Service B','Service C'])
    .map((name) => ({ name, description: '' }));
  return {
    type: 'services',
    content: {
      title: cfg?.title || 'Our Services',
      columns: cfg?.columns ?? 3,
      items,
    },
  };
}

export function makeFAQ(cfg?: Record<string, any>): any {
  const items = cfg?.items || [
    { question: 'What do you offer?', answer: 'We provide a variety of services tailored to your needs.' },
    { question: 'How do I get started?', answer: 'Contact us or click the CTA to get started.' },
  ];
  return { type: 'faq', content: { title: cfg?.title || 'Frequently Asked Questions', items } };
}

export function makeTestimonials(cfg?: Record<string, any>): any {
  const testimonials = cfg?.testimonials || [
    { quote: 'Amazing experience!', attribution: 'Happy Customer', rating: 5 },
  ];
  return { type: 'testimonial', content: { testimonials, randomized: true } };
}

export function makeContactForm(cfg?: Record<string, any>): any {
  return { type: 'contact_form', content: { title: cfg?.title || 'Contact Us', services: cfg?.services || [] } };
}

export function makeServiceAreas(cfg?: Record<string, any>): any {
  return {
    type: 'service_areas',
    content: {
      cities: Array.isArray(cfg?.cities) ? cfg.cities : [],
      allCities: Array.isArray(cfg?.allCities) ? cfg.allCities : [],
      sourceLat: cfg?.sourceLat ?? 0,
      sourceLng: cfg?.sourceLng ?? 0,
      radiusMiles: cfg?.radiusMiles ?? 0,
    },
  };
}

export function makeFooter(): any {
  return { type: 'footer', content: { logo_url: '', links: [] } };
}

export function buildBlock(key: BlockKey, cfg?: Record<string, any>, extras?: { siteName?: string; serviceNames?: string[] }) {
  switch (key) {
    case 'header': return makeHeader();
    case 'hero': return makeHero(cfg, extras?.siteName);
    case 'services': return makeServices(extras?.serviceNames || [], cfg);
    case 'faq': return makeFAQ(cfg);
    case 'testimonial': return makeTestimonials(cfg);
    case 'contact_form': return makeContactForm(cfg);
    case 'service_areas': return makeServiceAreas(cfg);
    case 'footer': return makeFooter();
    default: return null;
  }
}
