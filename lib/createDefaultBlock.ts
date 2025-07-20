// lib/createDefaultBlock.ts
import type { Block } from '@/types/blocks'; // adjust import path as needed
import crypto from 'crypto';

export function createDefaultBlock(type: Block['type']): Block {
  const _id = crypto.randomUUID?.() || Date.now().toString();

  switch (type) {
    case 'text':
      return {
        type,
        _id,
        content: {
          value: 'Sample text block',
        },
      };

    case 'image':
      return {
        type,
        _id,
        content: {
          url: 'https://placekitten.com/800/400',
          alt: 'A cute kitten',
        },
      };

    case 'video':
      return {
        type,
        _id,
        content: {
          url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          caption: 'Intro video',
        },
      };

    case 'audio':
      return {
        type,
        _id,
        content: {
          provider: 'spotify',
          url: 'https://spotify.com/sample',
          title: 'Sample Audio',
        },
      };

    case 'quote':
      return {
        type,
        _id,
        content: {
          text: 'This changed everything.',
          attribution: 'Jane Doe',
        },
      };

    case 'button':
      return {
        type,
        _id,
        content: {
          label: 'Click Me',
          href: '#',
          style: 'primary',
        },
      };

    case 'hero':
      return {
        type,
        _id,
        content: {
          headline: 'Welcome to Your Site!',
          subheadline: 'This is the hero section.',
          cta_text: 'Get Started',
          cta_link: '#',
          image_url: 'https://placekitten.com/1200/600',
        },
      };

    case 'services':
      return {
        type,
        _id,
        content: {
          items: ['Service A', 'Service B', 'Service C'],
        },
      };

    case 'testimonial':
      return {
        type,
        _id,
        content: {
          testimonials: [{ quote: 'They did a great job!', attribution: 'Happy Client' }],
        },
      };

    case 'cta':
      return {
        type,
        _id,
        content: {
          label: 'Learn More',
          link: '#about',
        },
      };

    case 'grid':
      return {
        type,
        _id,
        content: {
          columns: 2,
          items: [
            createDefaultBlock('text'),
            createDefaultBlock('image'),
          ],
        },
      };

    case 'footer':
      return {
        type,
        _id,
        content: {
          businessName: 'Grafton Towing',
          address: '1600 7th Ave',
          cityState: 'Grafton, WI',
          phone: '(262) 228-2491',
          links: [
            { label: 'Home', href: '/' },
            { label: 'Towing Service', href: '/towing-service' },
            { label: 'Emergency Towing', href: '/emergency-towing' },
            { label: 'Roadside Assistance', href: '/roadside-assistance' },
            { label: 'Auto Wrecking & Flatbed', href: '/auto-wrecking' },
          ],
        },
      };

    case 'service_areas':
      return {
        type: 'service_areas',
        _id,
        content: {
          title: 'Our Service Areas',
          subtitle: 'We proudly serve the surrounding towns and cities within 30 miles.',
          cities: [],
          sourceLat: 43.3242,
          sourceLng: -88.0899,
          allCities: [],
        },
      };
      
    default:
      return {
        type: 'text',
        _id,
        content: { value: `Unsupported block type: ${type}` },
      };
  }
}
