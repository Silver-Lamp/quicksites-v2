// lib/createDefaultBlock.ts
import type { BlockType } from '@/types/blocks';
import { normalizeBlock } from '@/lib/utils/normalizeBlock';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';
import { z } from 'zod';
import { BlockSchema } from '@/admin/lib/zod/blockSchema';

const clone = <T,>(v: T): T =>
  typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));

const newId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2)}`;

export function createDefaultBlock(type: BlockType): z.infer<typeof BlockSchema> {
  const _id = newId();

  // Always start with a plain object; DEFAULT_BLOCK_CONTENT may not have every key yet.
  const base: any = clone((DEFAULT_BLOCK_CONTENT as any)?.[type] ?? {});
  let content: any = base ?? {};

  switch (type) {
    /* ---------------- Layout / content helpers ---------------- */

    case 'grid': {
      content = {
        ...content,
        title: content.title ?? 'Grid',
        subtitle: content.subtitle ?? 'This is a grid block',
        layout: content.layout ?? 'grid',
        items: [
          {
            type: 'text',
            _id: newId(),
            content: { value: 'How fast is your response time? Usually within 30 minutes.' },
          },
          {
            type: 'text',
            _id: newId(),
            content: { value: 'This is a second text block inside the grid.' },
          },
        ],
      };
      break;
    }

    case 'testimonial': {
      content = {
        ...content,
        testimonials: [
          {
            quote: 'They did a great job!',
            attribution: 'Happy Client',
            avatar_url: 'https://placehold.co/96x96',
            rating: 5,
          },
        ],
        randomized: false,
      };
      break;
    }

    case 'faq': {
      content = {
        ...content,
        title: content.title ?? 'Frequently Asked Questions',
        items: content.items ?? [
          { question: 'How fast is your response time?', answer: 'Usually within 30 minutes.' },
          { question: 'Do you offer 24/7 towing?', answer: 'Yes, always on call.' },
        ],
      };
      break;
    }

    case 'services': {
      // strings are fine; schema coerces them into objects
      content = {
        ...content,
        items: content.items ?? ['Towing', 'Jump Starts', 'Battery Replacement'],
      };
      break;
    }

    /* ---------------- Site chrome ---------------- */

    case 'header': {
      content = {
        ...content,
        logo_url: content.logo_url ?? 'https://placehold.co/200x80',
        nav_items:
          content.nav_items ??
          [
            { label: 'Home', href: '/' },
            { label: 'Services', href: '/services' },
            { label: 'Contact', href: '/contact' },
          ],
      };
      break;
    }

    case 'footer': {
      content = {
        ...content,
        links: content.links ?? [{ label: 'Home', href: '/' }],
        logo_url: content.logo_url ?? 'https://placehold.co/200x80',
      };
      break;
    }

    /* ---------------- Hours ---------------- */

    case 'hours': {
      content = {
        ...content,
        title: content.title ?? 'Business Hours',
        tz: content.tz ?? 'America/Los_Angeles',
        alwaysOpen: !!content.alwaysOpen,
        note: content.note ?? '',
        display_style: content.display_style ?? 'table',
        days: Array.isArray(content.days) ? content.days : [],
        exceptions: Array.isArray(content.exceptions) ? content.exceptions : [],
      };
      break;
    }

    /* ---------------- NEW: Commerce blocks ---------------- */

    case 'products_grid': {
      content = {
        ...content,
        title: content.title ?? 'Featured Products',
        columns: Number.isFinite(content.columns) ? content.columns : 3,
        productIds: Array.isArray(content.productIds) ? content.productIds : [],
        products: Array.isArray(content.products) ? content.products : [],
      };
      break;
    }

    case 'service_offer': {
      content = {
        ...content,
        title: content.title ?? 'Featured Service',
        subtitle: typeof content.subtitle === 'string' ? content.subtitle : '',
        // accept legacy "description" and map to description_html
        description_html:
          typeof content.description_html === 'string'
            ? content.description_html
            : typeof content.description === 'string'
            ? content.description
            : '',
        price_cents: typeof content.price_cents === 'number' ? content.price_cents : 0,
        compare_at_cents:
          typeof content.compare_at_cents === 'number' ? content.compare_at_cents : undefined,
        image_url: typeof content.image_url === 'string' ? content.image_url : '',
        cta_text: typeof content.cta_text === 'string' ? content.cta_text : 'Get Started',
        cta_link: typeof content.cta_link === 'string' ? content.cta_link : '/contact',
        productId: typeof content.productId === 'string' ? content.productId : undefined,
        showPrice: typeof content.showPrice === 'boolean' ? content.showPrice : true,
      };
      break;
    }

    /* ---------------- NEW: Scheduler block ---------------- */

    case 'scheduler': {
      content = {
        ...content,
        title: typeof content.title === 'string' && content.title.trim()
          ? content.title
          : 'Book an appointment',
        subtitle: typeof content.subtitle === 'string' ? content.subtitle : 'Choose a time that works for you',
        org_id: typeof content.org_id === 'string' ? content.org_id : undefined,
        service_ids: Array.isArray(content.service_ids) ? content.service_ids : [],
        default_service_id:
          typeof content.default_service_id === 'string' ? content.default_service_id : undefined,
        show_resource_picker:
          typeof content.show_resource_picker === 'boolean' ? content.show_resource_picker : false,
        timezone: typeof content.timezone === 'string' && content.timezone
          ? content.timezone
          : 'America/Los_Angeles',
        slot_granularity_minutes:
          Number.isFinite(content.slot_granularity_minutes) ? content.slot_granularity_minutes : 30,
        lead_time_minutes:
          Number.isFinite(content.lead_time_minutes) ? content.lead_time_minutes : 120,
        window_days: Number.isFinite(content.window_days) ? content.window_days : 14,
        confirmation_message:
          typeof content.confirmation_message === 'string' && content.confirmation_message
            ? content.confirmation_message
            : 'Thanks! Your appointment is confirmed.',
      };
      break;
    }

    /* ---------------- Misc (leave base content as-is) ---------------- */

    case 'chef_profile': {
      content = {
        ...content,
        certifications: content.certifications ?? ['Certification A', 'Certification B'],
        meals: content.meals ?? [
          {
            id: newId(),
            name: 'Meal A',
            description: 'This is a description',
            price: '$10',
            availability: 'Available',
            image_url: 'https://placehold.co/800x400',
          },
        ],
      };
      break;
    }

    default:
      // keep `content` as the cloned base or {}
      break;
  }

  // Let the central normalizer handle id, aliases, and Zod validation
  return normalizeBlock({ type, _id, content }) as z.infer<typeof BlockSchema>;
}
