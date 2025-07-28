// lib/createDefaultBlock.ts
import type { Block, BlockType, BlockWithId } from '@/types/blocks';
import { BLOCK_TYPES } from '@/types/blocks';
import crypto from 'crypto';
import { normalizeBlock } from '@/types/blocks';

export function createDefaultBlock(type: BlockType): BlockWithId {
  const _id = crypto.randomUUID?.() || Date.now().toString();

  switch (type) {
    case 'text':
      return normalizeBlock({ type, _id, content: { value: 'Sample text block' } });

    case 'image':
      return normalizeBlock({ type, _id, content: { url: 'https://placekitten.com/800/400', alt: 'A cute kitten' } });

    case 'video':
      return normalizeBlock({ type, _id, content: { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', caption: 'Intro video' } });

    case 'audio':
      return normalizeBlock({ type, _id, content: { provider: 'spotify', url: 'https://spotify.com/sample', title: 'Sample Audio' } });

    case 'quote':
      return normalizeBlock({ type, _id, content: { text: 'This changed everything.', attribution: 'Jane Doe' } });

    case 'button':
      return normalizeBlock({ type, _id, content: { label: 'Click Me', href: '#', style: 'primary' } });

    case 'hero':
      return normalizeBlock({
        type,
        _id,
        content: {
          headline: 'Welcome to Your Site!',
          subheadline: 'This is the hero section.',
          cta_text: 'Get Started',
          cta_link: '#',
          image_url: 'https://placekitten.com/1200/600',
        },
      });

    case 'services':
      return normalizeBlock({ type, _id, content: { items: ['Service A', 'Service B', 'Service C'] } });

    case 'contact_form':
      return normalizeBlock({ type, _id, content: { title: 'Contact Us', notification_email: 'sandon@quicksites.ai' } });

    case 'testimonial':
      return normalizeBlock({
        type,
        _id,
        content: {
          testimonials: [{ quote: 'They did a great job!', attribution: 'Happy Client' }],
        },
      });

    case 'cta':
      return normalizeBlock({ type, _id, content: { label: 'Learn More', link: '#about' } });

    case 'faq':
      return normalizeBlock({
        type,
        _id,
        content: {
          title: 'Frequently Asked Questions',
          subtitle: '',
          items: [
            { question: 'How fast is your response time?', answer: 'Usually within 30 minutes.' },
            { question: 'Do you offer 24/7 towing?', answer: 'Yes, always on call.' },
          ],
          layout: 'accordion',
        },
      });

    case 'grid':
      return normalizeBlock({
        type,
        _id,
        content: {
          columns: 2,
          items: [createDefaultBlock('text'), createDefaultBlock('image')],
        },
      });

    case 'footer':
      return normalizeBlock({
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
      });

    case 'service_areas':
      return normalizeBlock({
        type,
        _id,
        content: {
          title: 'Our Service Areas',
          subtitle: 'We serve a 30 mile radius.',
          cities: [],
          allCities: [],
          sourceLat: 43.3242,
          sourceLng: -88.0899,
          radiusMiles: 30,
        },
      });

    case 'header':
      return normalizeBlock({
        type,
        _id,
        content: {
          logoUrl: '/logo.png',
          navItems: [
            { label: 'Home', href: '/' },
            { label: 'Services', href: '/services' },
            { label: 'Contact', href: '/contact' },
          ],
        },
      });

    default:
      return normalizeBlock({
        type: 'text',
        _id,
        content: { value: `Unsupported block type: ${type}` },
      });
  }
}
