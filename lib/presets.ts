// lib/presets.ts
import type { TemplateData } from "@/types/template";
import type { Page } from "@/types/template";

export const industryPresets: TemplateData = {
    pages: [
    {
      title: 'Towing',
      slug: 'towing',
      content_blocks: [
        {
        type: 'hero',
        headline: '24/7 Emergency Towing',
        subheadline: 'Serving your city with pride.',
        cta_text: 'Call Now',
        cta_link: '/contact',
      },
      {
        type: 'services',
        items: ['Roadside Assistance', 'Jump Starts', 'Flatbed Towing'],
      },
      {
        type: 'testimonial',
        quote: 'Fast and professional. 5 stars!',
        attribution: 'Alex T., Customer',
      },
      ]
    },
    {
      title: 'Dentistry',
      slug: 'dentistry',
      content_blocks: [
      {
        type: 'hero',
        headline: 'Gentle Dentistry, Modern Tools',
        subheadline: 'Accepting new patients today.',
        cta_text: 'Book Appointment',
        cta_link: '/book',
      },
      {
        type: 'testimonial',
        quote: 'They made me smile again!',
        attribution: 'Sara M., Patient',
      },
      {
        type: 'services',
        items: ['Cleanings', 'Whitening', 'Fillings'],
      },
      ]
    },
    {
      title: 'Default',
      slug: 'default',
      content_blocks: [
      {
        type: 'hero',
        headline: 'Welcome to Our Website',
        subheadline: "We're glad you're here.",
        cta_text: 'Learn More',
        cta_link: '/about',
      },
      {
        type: 'cta',
        label: 'Contact Us',
        link: '/contact',
      },
      ]
    },
  ] as unknown as Page[]
};