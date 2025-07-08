// lib/presets.ts
import type { PresetMap } from "@/types/blocks";

export const industryPresets: PresetMap = {
    towing: {
      hero: {
        type: 'hero',
        headline: '24/7 Emergency Towing',
        subheadline: 'Serving your city with pride.',
        cta_text: 'Call Now',
        cta_link: '/contact',
      },
      services: {
        type: 'services',
        items: ['Roadside Assistance', 'Jump Starts', 'Flatbed Towing'],
      },
      testimonial: {
        type: 'testimonial',
        quote: 'Fast and professional. 5 stars!',
        attribution: 'Alex T., Customer',
      },
    },
    dentistry: {
      hero: {
        type: 'hero',
        headline: 'Gentle Dentistry, Modern Tools',
        subheadline: 'Accepting new patients today.',
        cta_text: 'Book Appointment',
        cta_link: '/book',
      },
      testimonial: {
        type: 'testimonial',
        quote: 'They made me smile again!',
        attribution: 'Sara M., Patient',
      },
      services: {
        type: 'services',
        items: ['Cleanings', 'Whitening', 'Fillings'],
      },
    },
    default: {
      hero: {
        type: 'hero',
        headline: 'Welcome to Our Website',
        subheadline: "We're glad you're here.",
        cta_text: 'Learn More',
        cta_link: '/about',
      },
      cta: {
        type: 'cta',
        label: 'Contact Us',
        link: '/contact',
      },
    },
  };