// admin/lib/zod/blockSchema.ts
import { z } from 'zod';

/* ───────────────────────────── URL helpers ───────────────────────────── */

const RelativeOrAbsoluteUrl = z
  .string()
  .min(1)
  .refine(
    (v) => /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(v),
    { message: 'Link must start with http(s)://, /, #, mailto:, or tel:' }
  );

const urlOptional = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().url('Kitchen video URL must be valid').optional()
);

const REL = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

// "$19.99" | "19" | 19.99 → 1999
const usdToCents = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100);
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  return null;
};

/* ───────────────────────────── Hours of Operation ───────────────────────── */

export const hoursOfOperationPropsSchema = z.object({
  title: z.string().optional(),
  tz: z.string().optional(),
  alwaysOpen: z.boolean().optional(),
  note: z.string().optional(),
  display_style: z.enum(['table', 'stack']).optional(),
  days: z
    .array(
      z.object({
        key: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
        label: z.string(),
        closed: z.boolean(),
        periods: z
          .array(
            z.object({
              open: z.string(),
              close: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional(),
});

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type HoursPeriod = { open: string; close: string };
export type SpecialHours = {
  id: string;
  label?: string;
  date: string;
  recurring?: boolean;
  closed?: boolean;
  periods: HoursPeriod[];
};
export type HoursOfOperationContent = {
  title?: string;
  tz?: string;
  alwaysOpen?: boolean;
  note?: string;
  display_style?: 'table' | 'stack';
  days: Array<{ key: DayKey; label: string; closed: boolean; periods: HoursPeriod[] }>;
  exceptions?: SpecialHours[];
};

export function defaultHoursContent(
  partial?: Partial<HoursOfOperationContent>
): HoursOfOperationContent {
  const baseDays: HoursOfOperationContent['days'] = [
    { key: 'mon', label: 'Mon', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'tue', label: 'Tue', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'wed', label: 'Wed', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'thu', label: 'Thu', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'fri', label: 'Fri', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'sat', label: 'Sat', closed: true, periods: [] },
    { key: 'sun', label: 'Sun', closed: true, periods: [] },
  ];
  return {
    title: 'Business Hours',
    tz: 'America/Los_Angeles',
    alwaysOpen: false,
    note: '',
    display_style: 'table',
    days: partial?.days ?? baseDays,
    exceptions: partial?.exceptions ?? [],
    ...partial,
  };
}

export const HoursPeriodSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

const SpecialHoursSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurring: z.boolean().optional(),
  closed: z.boolean().optional(),
  periods: z.array(HoursPeriodSchema),
});

export const HoursOfOperationSchema = z.object({
  title: z.string().optional(),
  tz: z.string().optional(),
  alwaysOpen: z.boolean().optional(),
  note: z.string().optional(),
  display_style: z.enum(['table', 'stack']).optional(),
  days: z.array(
    z.object({
      key: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
      label: z.string(),
      closed: z.boolean(),
      periods: z.array(HoursPeriodSchema),
    })
  ),
  exceptions: z.array(SpecialHoursSchema).optional(),
});

/* ───────────────────────────── Shared Link schema ─────────────────────────── */

const LinkSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  href: RelativeOrAbsoluteUrl.default('/'),
  appearance: z.string().optional(),
});

/* ─────────────────────────────── Text / Exterior ─────────────────────────── */

// legacy minimal type (kept)
export const ExteriorCleaningContent = z.object({
  brand: z.string().min(1, 'Brand is required'),
  tagline: z.string().min(1, 'Tagline is required'),
  subTagline: z.string().optional(),
});

// richer, editor-friendly schema used by exterior_* blocks
export const ExteriorAgencyPropsSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  tagline: z.string().min(1, 'Tagline is required'),
  subTagline: z.string().optional(),

  ctaLabel: z.string().default('Get a Free Quote').optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  heroImage: z.string().url().optional(),
  badges: z.array(z.string()).default([]).optional(),

  services: z.array(z.object({
    title: z.string(),
    blurb: z.string().default(''),
    bullets: z.array(z.string()).default([]).optional(),
    icon: z.string().optional(),
  })).default([]),

  packages: z.array(z.object({
    name: z.string(),
    price: z.string().optional(),
    description: z.string().optional(),
    bullets: z.array(z.string()).default([]).optional(),
    featured: z.boolean().default(false).optional(),
  })).default([]),

  portfolio: z.array(z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    before: z.string().url(),
    after: z.string().url(),
  })).default([]),

  testimonials: z.array(z.object({
    quote: z.string(),
    author: z.string(),
    role: z.string().optional(),
  })).default([]),

  serviceAreas: z.array(z.string()).default([]).optional(),
  footerNote: z.string().optional(),
}).passthrough();

// legacy minimal schema (kept for compatibility; not used by new blocks)
export const ExteriorCleaningContentSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  tagline: z.string().min(1, 'Tagline is required'),
  subTagline: z.string().optional(),
}).passthrough();

export const TextBlockContent = z.preprocess((raw) => {
  const c = raw && typeof raw === 'object' ? { ...(raw as any) } : {};
  if (typeof (c as any).value === 'string' && !c.html && !c.json) {
    (c as any).html = (c as any).value;
    (c as any).format = (c as any).format ?? 'html';
  }
  return c;
}, z.object({
  format: z.enum(['tiptap', 'html']).default('tiptap'),
  json: z.record(z.any()).optional(),
  html: z.string().optional(),
  summary: z.string().optional(),
  word_count: z.number().optional(),
}));

export const TextBlockSchema = z.object({
  type: z.literal('text'),
  content: TextBlockContent,
  meta: z.record(z.any()).optional(),
  tags: z.array(z.string()).default([]),
  tone: z.string().default('neutral'),
});

/* ─────────────────────────── Meals/Reviews helpers ────────────────────────── */

const emptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);

/* ─────────────────────────── Header / Footer blocks ───────────────────────── */

export const HeaderContent = z.preprocess((raw) => {
  const c = raw && typeof raw === 'object' ? { ...(raw as any) } : {};
  if (Array.isArray(c.navItems) && !Array.isArray(c.nav_items)) c.nav_items = c.navItems;
  if (Array.isArray(c.links) && !Array.isArray(c.nav_items)) c.nav_items = c.links;
  if (typeof c.logoUrl === 'string' && !c.logo_url) c.logo_url = c.logoUrl;
  delete c.navItems;
  delete c.logoUrl;
  return c;
}, z.object({
  logo_url: z.string().optional(),
  nav_items: z.array(LinkSchema).default([]),
}));

const toCityString = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    const name = (o.name ?? o.city ?? o.label ?? '') as string;
    const addr = (o.address ?? o.street ?? '') as string;
    const city = [name, addr].filter(Boolean).join(' ').trim();
    return city || JSON.stringify(item);
  }
  return String(item ?? '');
};

const FooterContent = z.preprocess((raw) => {
  const c = raw && typeof raw === 'object' ? { ...(raw as any) } : {};

  if (Array.isArray(c.nav_items) && !Array.isArray(c.links)) c.links = c.nav_items;
  if (Array.isArray(c.navItems) && !Array.isArray(c.links)) c.links = c.navItems;
  if (typeof c.logoUrl === 'string' && !c.logo_url) c.logo_url = c.logoUrl;

  if (Array.isArray(c.links)) {
    c.links = c.links
      .map((l: any) => {
        const label = String(l?.label ?? '').trim();
        const hrefRaw = String(l?.href ?? '').trim();
        const href = hrefRaw || '/';
        const appearance = l?.appearance;
        return { label, href, appearance };
      })
      .filter((l: any) => l.label && REL.test(l.href));
  }

  delete c.nav_items;
  delete c.navItems;
  delete c.logoUrl;

  return c;
}, z.object({
  logo_url: z.string().optional(),
  links: z.array(LinkSchema).default([]),
}).passthrough());

/* ───────────────────────────── Menu (restaurant) ──────────────────────────── */
// A display menu grouped into sections (Breakfast / Lunch / …). Prices are kept as
// freeform display strings (scraped/AI menu prices are messy — "$14", "MP", "14/18"),
// while `catalog_item_id` + `price_cents` are the optional ordering linkage (set when
// a menu item is wired to a catalog_item so "Add to order" can hit checkout).
// A "choose one" option (Small/Large, 6pc/12pc, Half/Full). Each carries its own
// price; `variant_id` is the ordering linkage (set when published to a catalog item's
// variants) so "Add to order" can pick the right priced SKU.
export const MenuItemOptionSchema = z.object({
  label: z.string(),
  price: z.string().optional().default(''),
  price_cents: z.number().int().min(0).optional(),
  variant_id: z.string().optional(),
});

// A multi-select add-on (extra cheese, bacon, no onions). `id` is the ordering
// linkage (set when published to the catalog item's metadata.addons).
export const MenuItemAddonSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  price: z.string().optional().default(''),
  price_cents: z.number().int().min(0).optional(),
});

export const MenuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  price: z.string().optional().default(''),
  image_url: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  options: z.array(MenuItemOptionSchema).optional().default([]),
  addons: z.array(MenuItemAddonSchema).optional().default([]),
  catalog_item_id: z.string().optional(),
  price_cents: z.number().int().min(0).optional(),
});

export const MenuSectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  items: z.array(MenuItemSchema).default([]),
});

export const MenuBlockSchema = z.preprocess((raw) => {
  const c = raw && typeof raw === 'object' ? { ...(raw as any) } : {};
  if (!c.title) c.title = 'Menu';
  if (!Array.isArray(c.sections)) c.sections = [];
  // Coerce numeric item prices → display strings so scraped/AI numbers don't drop.
  c.sections = c.sections.map((s: any) => ({
    ...s,
    items: Array.isArray(s?.items)
      ? s.items.map((it: any) => ({
          ...it,
          price: typeof it?.price === 'number' ? `$${it.price}` : it?.price,
        }))
      : [],
  }));
  return c;
}, z.object({
  title: z.string().default('Menu'),
  note: z.string().optional().default(''),
  currency: z.string().optional().default('USD'),
  sections: z.array(MenuSectionSchema).default([]),
}));

/* ───────────────────────────── Location & Map ─────────────────────────────── */
// A location card: address + tap-to-call phone + "Get Directions" + an optional
// keyless map embed. `map_query`/`directions_url` fall back to the address.
export const LocationBlockSchema = z.object({
  title: z.string().default('Find Us'),
  business_name: z.string().optional().default(''),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().optional().default(''),
  map_query: z.string().optional().default(''),
  show_map: z.boolean().optional().default(true),
  directions_url: z.string().optional().default(''),
});

/* ───────────────────────────── Sticky order bar ───────────────────────────── */
// A mobile-only sticky bottom bar (the ChowNow/Toast pattern): a tap-to-call action
// + a primary CTA that jumps to the menu (or links out to an ordering URL). Hidden
// on desktop. `cta_href` starting with '#' smooth-scrolls to the on-page menu.
export const OrderBarSchema = z.object({
  phone: z.string().optional().default(''),
  call_label: z.string().optional().default('Call'),
  cta_label: z.string().optional().default('View Menu'),
  cta_href: z.string().optional().default('#menu'),
  enabled: z.boolean().optional().default(true),
});

/* ───────────────────────────── Block schema map ───────────────────────────── */

export const blockContentSchemaMap = {
  // exterior-agency family → richer schema
  exterior_agency:            { label: 'Exterior Agency',          icon: '🏠', schema: ExteriorAgencyPropsSchema },
  exterior_cleaning_agency:   { label: 'Exterior Cleaning Agency', icon: '🏠', schema: ExteriorAgencyPropsSchema },
  pnw_prestige:               { label: 'PNW Prestige',             icon: '🏠', schema: ExteriorAgencyPropsSchema },

  text: { label: 'Text Block', icon: '📝', schema: TextBlockContent },

  image: {
    label: 'Image',
    icon: '🖼️',
    schema: z.object({
      url: z.string().url('Image URL must be valid'),
      alt: z.string().optional(),
    }),
  },

  grid: {
    label: 'Grid Layout',
    icon: '🔲',
    schema: z.object({
      columns: z.number().min(1).max(12).default(2),
      items: z.array(z.lazy(() => BlockSchema as any)).default([]),
      title: z.string().optional(),
      subtitle: z.string().optional(),
      layout: z.string().optional(),
    }),
  },

  // Multi-column section: each column holds its own child blocks side-by-side
  // (stacks on mobile). The nesting foundation for L4 (see docs/LAYOUT_L4_PLAN.md).
  section: {
    label: 'Columns',
    icon: '▥',
    schema: z.object({
      columns: z
        .array(
          z.object({
            span: z.number().min(1).max(12).optional(),
            items: z.array(z.lazy(() => BlockSchema as any)).default([]),
          }),
        )
        .default([]),
      gap: z.enum(['sm', 'md', 'lg']).default('md'),
      align: z.enum(['start', 'center', 'stretch']).default('stretch'),
      reverseOnMobile: z.boolean().optional(),
      title: z.string().optional(),
    }),
  },

  quote: {
    label: 'Quote',
    icon: '❝',
    schema: z.object({ text: z.string().min(1), attribution: z.string().optional() }),
  },

  button: {
    label: 'Button',
    icon: '🔘',
    schema: z.object({
      label: z.string().min(1),
      href: RelativeOrAbsoluteUrl.default('/'),
      style: z.enum(['primary', 'secondary', 'ghost']).optional(),
    }),
  },

  hero: {
    label: 'Hero',
    icon: '🎯',
    schema: z.preprocess((raw) => {
      const c = raw && typeof raw === 'object' ? { ...(raw as any) } : {};

      // Legacy → canonical
      if (c.heading != null && c.headline == null) c.headline = c.heading;
      if (c.subheading != null && c.subheadline == null) c.subheadline = c.subheading;
      if (c.ctaLabel != null && c.cta_text == null) c.cta_text = c.ctaLabel;
      if (c.ctaHref != null && c.cta_link == null) c.cta_link = c.ctaHref;
      if (c.imageUrl != null && c.image_url == null) c.image_url = c.imageUrl;

      // Safe defaults
      if (c.headline == null || String(c.headline).trim() === '') c.headline = 'Welcome';
      if (c.subheadline == null) c.subheadline = '';
      if (c.cta_text == null) c.cta_text = '';
      if (c.cta_link == null) c.cta_link = '/';
      if (c.image_url == null) c.image_url = '';

      if (c.layout_mode == null) c.layout_mode = 'inline';
      if (c.mobile_layout_mode == null) c.mobile_layout_mode = 'inline';
      if (c.mobile_crop_behavior == null) c.mobile_crop_behavior = 'cover';
      if (c.image_position == null) c.image_position = 'center';

      return c;
    }, z.object({
      headline: z.string().min(1).default('Welcome'),
      subheadline: z.string().optional().default(''),
      cta_text: z.string().optional().default(''),
      cta_link: z.string().optional().default('/'),
      image_url: z.union([z.string().url(), z.literal('')]).optional().default(''),
      layout_mode: z.enum([
        'inline','background','full_bleed','natural_height','full_width','full_height','full_width_height','cover'
      ]).default('inline'),
      mobile_layout_mode: z.enum([
        'inline','background','full_bleed','natural_height','full_width','full_height','full_width_height','cover','full_width_height_mobile'
      ]).optional().default('inline'),
      mobile_crop_behavior: z.enum(['contain','cover','none']).optional().default('cover'),
      blur_amount: z.number().min(0).max(100).optional(),
      parallax_enabled: z.boolean().optional(),
      image_position: z.enum(['top','center','bottom']).default('center'),
      image_x: z.number().min(0).max(100).optional(),
      image_y: z.number().min(0).max(100).optional(),
      // Hide the overlaid headline/subheadline — e.g. when the background image
      // already contains that text.
      hide_headline: z.boolean().optional().default(false),
      hide_subheadline: z.boolean().optional().default(false),
      hide_cta: z.boolean().optional().default(false),
    })),
  },

  services: {
    label: 'Services',
    icon: '🧰',
    schema: z.preprocess((raw) => {
      const c = raw && typeof raw === 'object' ? { ...(raw as any) } : {};

      if (Array.isArray(c.items)) {
        c.items = c.items
          .map((it: any) => {
            if (typeof it === 'string') {
              return { name: it, description: '', price: undefined, href: undefined, icon: undefined };
            }
            if (it && typeof it === 'object') {
              const o: any = { ...it };
              if (o.title && !o.name) o.name = o.title;
              if (o.link && !o.href) o.href = o.link;
              return {
                name: String(o.name ?? '').trim(),
                description: typeof o.description === 'string' ? o.description : '',
                price: typeof o.price === 'string' ? o.price : undefined,
                href: typeof o.href === 'string' ? o.href : undefined,
                icon: typeof o.icon === 'string' ? o.icon : undefined,
              };
            }
            return null;
          })
          .filter(Boolean);
      }

      if (!Array.isArray(c.items) || c.items.length === 0) {
        c.items = [{ name: 'Service A', description: '' }];
      }

      if (c.columns == null) c.columns = 3;
      if (typeof c.title !== 'string') c.title = undefined;

      return c;
    }, z.object({
      title: z.string().optional(),
      columns: z.number().int().min(1).max(6).default(3),
      // Per-block layout override; falls back to the theme's featureVariant.
      variant: z.enum(['grid', 'cards', 'rows']).optional(),
      items: z.array(z.object({
        name: z.string().min(1),
        description: z.string().default(''),
        price: z.string().optional(),
        href: z.string().optional(),
        icon: z.string().optional(),
      })).min(1),
    })),
  },

  cta: {
    label: 'Call to Action',
    icon: '🔘',
    schema: z.object({
      label: z.string().min(1),
      href: RelativeOrAbsoluteUrl.default('/'),
      style: z.enum(['primary', 'secondary', 'ghost']).optional(),
    }),
  },

  service_areas: {
    label: 'Service Areas',
    icon: '🌍',
    schema: z.preprocess((raw) => {
      const c = (raw && typeof raw === 'object') ? { ...(raw as any) } : {};

      const cities = Array.isArray(c.cities) ? c.cities.map(toCityString).filter(Boolean) : [];
      const allCities = Array.isArray(c.allCities)
        ? c.allCities.map(toCityString).filter(Boolean)
        : [...cities];

      if (c.source && typeof c.source === 'object') {
        const s = c.source as any;
        c.sourceLat ??= s.lat ?? s.latitude ?? s.y;
        c.sourceLng ??= s.lng ?? s.longitude ?? s.x;
      }
      if (c.radius_miles != null && c.radiusMiles == null) c.radiusMiles = c.radius_miles;

      const toNum = (v: any, d = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : d;
      };

      return {
        cities,
        allCities,
        sourceLat: toNum(c.sourceLat, 0),
        sourceLng: toNum(c.sourceLng, 0),
        radiusMiles: toNum(c.radiusMiles, 0),
      };
    }, z.object({
      cities: z.array(z.string()).default([]),
      allCities: z.array(z.string()).default([]),
      sourceLat: z.number().default(0),
      sourceLng: z.number().default(0),
      radiusMiles: z.number().default(0),
    })),
  },

  audio: {
    label: 'Audio',
    icon: '🎧',
    schema: z.object({
      provider: z.enum(['spotify', 'soundcloud', 'suno']),
      url: z.string().url('Audio URL must be valid'),
      title: z.string().optional(),
    }),
  },

  video: {
    label: 'Video',
    icon: '📹',
    schema: z.object({ url: z.string().url('Video URL must be valid'), caption: z.string().optional() }),
  },

  footer: { label: 'Footer', icon: '🏠', schema: FooterContent },
  header: { label: 'Header', icon: '🏠', schema: HeaderContent },

  faq: {
    label: 'FAQ',
    icon: '❓',
    schema: z.object({
      title: z.string().min(1),
      items: z.array(z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      })).min(1),
    }),
  },

  testimonial: {
    label: 'Testimonial',
    icon: '💬',
    schema: z.object({
      testimonials: z.array(z.object({
        quote: z.string().min(1),
        attribution: z.string().optional(),
        avatar_url: z.union([z.string().url(), z.literal('')]).optional(),
        rating: z.number().min(1).max(5).optional(),
      })).min(1),
      randomized: z.boolean().optional(),
    }),
  },

  contact_form: {
    label: 'Contact Form',
    icon: '📧',
    schema: z.object({
      title: z.string().min(1),
      services: z.array(z.string()).optional(),
    }),
  },

  // Alternating image + text "story" sections (brand storytelling — e.g. a converted
  // Shopify site's "Created by…" / "How it works" panels). Rendered image-left/right,
  // stacking on mobile.
  story: {
    label: 'Story Sections',
    icon: '📖',
    schema: z.object({
      title: z.string().optional(),
      sections: z.array(z.object({
        heading: z.string().min(1),
        body: z.string().default(''),
        image_url: z.union([z.string().url(), z.literal('')]).optional(),
        cta_text: z.string().optional(),
        // Empty string → undefined so a section with no CTA validates cleanly.
        cta_link: z.preprocess(
          (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
          RelativeOrAbsoluteUrl.optional(),
        ),
      })).min(1),
    }),
  },


  hours: { label: 'Hours of Operation', icon: '⏰', schema: HoursOfOperationSchema },

  menu: { label: 'Menu', icon: '🍽️', schema: MenuBlockSchema },

  location: { label: 'Location & Map', icon: '📍', schema: LocationBlockSchema },

  order_bar: { label: 'Sticky Order Bar', icon: '🛎️', schema: OrderBarSchema },

  // Restaurant apex portals (<city>-restaurant.com): the live winner-first directory of a
  // domain-competition cohort. `campaign_id` drives a client-side live fetch; `entries`
  // is the commit-time snapshot fallback so the block renders without the API.
  restaurants_directory: {
    label: 'Restaurants Directory',
    icon: '🏆',
    schema: z.object({
      title: z.string().optional().default(''),
      campaign_id: z.string().optional().default(''),
      entries: z
        .array(
          z.object({
            template_id: z.string(),
            slug: z.string(),
            business_name: z.string(),
            url: z.string(),
            hero_url: z.union([z.string(), z.literal('')]).optional(),
            is_winner: z.boolean().optional().default(false),
          }),
        )
        .default([]),
    }),
  },

  // "About That" (HiveJournal): AI narration of the page, embedded via HiveJournal's
  // loader script — the player, rendering, caching, and rate limits all live on
  // HiveJournal; this block only emits <script … data-embed>. embed_id must be a real
  // HiveJournal embed uuid for a working player, but the DATA layer accepts '' so a
  // freshly-inserted block validates — the renderer shows a setup hint until set.
  about_that: {
    label: 'About That (narration)',
    icon: '🎙️',
    schema: z.object({
      embed_id: z.string().optional().default(''),
      /** Overrides the narrated URL (data-url); empty = the page's own address. */
      url: z.string().optional().default(''),
      /** Sizes the player iframe (data-width), e.g. "480" or "100%". */
      width: z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().optional().default('')),
    }),
  },

  // Real-estate listing card: the on-domain listing page most agent sites lack —
  // address/price/beds/baths/gallery/inquiry CTA with a built-in About That
  // agent-preset player slot (the HiveJournal narration embed; see BLOCKS_BACKLOG.md
  // Tier 4). Display fields are freeform strings on purpose: real listings say
  // "$524,900", "2.5 baths", "Offer pending" — we render, not compute.
  listing_card: {
    label: 'Real Estate Listing',
    icon: '🏠',
    schema: z.object({
      headline: z.string().optional().default(''),
      address: z.string().optional().default(''),
      price: z.string().optional().default(''),
      status: z.string().optional().default('For sale'),
      beds: z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().optional().default('')),
      baths: z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().optional().default('')),
      sqft: z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().optional().default('')),
      description: z.string().optional().default(''),
      images: z.array(z.string()).default([]),
      cta_text: z.string().optional().default('Request a showing'),
      cta_link: z.string().optional().default('#contact'),
      /** About That agent-preset slot — the owner-voice pitch player for this listing. */
      about_that_embed_id: z.string().optional().default(''),
      about_that_width: z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().optional().default('')),
    }),
  },

  /* ───────────────────────────── NEW: Commerce blocks ─────────────────────── */

  products_grid: {
    label: 'Products Grid',
    icon: '🛒',
    schema: z.preprocess((raw) => {
      const c = raw && typeof raw === 'object' ? { ...(raw as any) } : {};

      // Aliases → canonical
      if (Array.isArray((c as any).product_ids) && !Array.isArray((c as any).productIds)) {
        (c as any).productIds = (c as any).product_ids;
      }
      if (Array.isArray((c as any).ids) && !Array.isArray((c as any).productIds)) {
        (c as any).productIds = (c as any).ids;
      }
      if (Array.isArray((c as any).items) && !Array.isArray((c as any).productIds)) {
        (c as any).productIds = (c as any).items.map((x: any) => x?.id).filter(Boolean);
      }

      // Normalize columns
      if (typeof (c as any).columns === 'string') {
        const n = Number((c as any).columns);
        (c as any).columns = Number.isFinite(n) ? n : 3;
      }

      // Build products from legacy shapes (items/products)
      const src = Array.isArray((c as any).products)
        ? (c as any).products
        : Array.isArray((c as any).items)
        ? (c as any).items
        : [];

      const products = src
        .map((p: any, i: number) => {
          if (!p || typeof p !== 'object') return null;
          const id = String(p.id ?? p.product_id ?? p.slug ?? p.sku ?? `p${i + 1}`);
          const title = String(p.title ?? p.name ?? `Item ${i + 1}`);
          const cents =
            typeof p.price_cents === 'number' ? p.price_cents : usdToCents(p.price) ?? 0;
          const image_url = p.image_url ?? p.imageUrl ?? p.image ?? '';
          return { id, title, price_cents: Math.max(0, Math.round(cents)), image_url };
        })
        .filter(Boolean);

      if (!Array.isArray((c as any).products) && products.length) {
        (c as any).products = products;
      }

      // Defaults
      if (!(c as any).title) (c as any).title = 'Featured Products';
      if ((c as any).columns == null) (c as any).columns = 3;
      if (!Array.isArray((c as any).productIds)) (c as any).productIds = [];

      return c;
    }, z.object({
      title: z.string().default('Featured Products'),
      columns: z.number().int().min(1).max(6).default(3),
      productIds: z.array(z.string()).default([]),
      products: z.array(z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        price_cents: z.number().int().min(0).default(0),
        image_url: z.union([z.string().url(), z.literal('')]).optional(),
      })).default([]),
    })),
  },

  service_offer: {
    label: 'Service Offer',
    icon: '🛎️',
    schema: z.preprocess((raw) => {
      const c = raw && typeof raw === 'object' ? { ...(raw as any) } : {};

      // Aliases → canonical
      if (c.serviceId && !c.productId) c.productId = c.serviceId;
      if (c.product_id && !c.productId) c.productId = c.product_id;

      if (c.cta && !c.cta_text) c.cta_text = c.cta;
      if (c.href && !c.cta_link) c.cta_link = c.href;
      if (c.image && !c.image_url) c.image_url = c.image;

      // Plain-text to HTML
      if (typeof c.description === 'string' && !c.description_html) {
        c.description_html = c.description;
      }

      // Price coercion
      if (c.price_cents == null && c.price != null) {
        const cents = usdToCents(c.price);
        if (cents != null) c.price_cents = cents;
      }
      if (c.compare_at_cents == null && c.compareAt != null) {
        const cents = usdToCents(c.compareAt);
        if (cents != null) c.compare_at_cents = cents;
      }

      // Defaults
      if (!c.title) c.title = 'Featured Service';
      if (c.subtitle == null) c.subtitle = '';
      if (c.description_html == null) c.description_html = '';
      if (typeof c.showPrice !== 'boolean') c.showPrice = true;
      if (!('cta_text' in c)) c.cta_text = 'Get Started';
      if (!('cta_link' in c)) c.cta_link = '/contact';

      return c;
    }, z.object({
      title: z.string().min(1).default('Featured Service'),
      subtitle: z.string().optional().default(''),
      description_html: z.string().optional().default(''),
      price_cents: z.number().int().min(0).optional(),
      compare_at_cents: z.number().int().min(0).optional(),
      image_url: z.union([z.string().url(), z.literal('')]).optional(),
      cta_text: z.string().optional().default('Get Started'),
      cta_link: RelativeOrAbsoluteUrl.optional().default('/contact'),
      productId: z.string().min(1).optional(),
      showPrice: z.boolean().default(true),
    })),
  },

  /* ───────────────────────────── NEW: Scheduler block ─────────────────────── */

  scheduler: {
    label: 'Service Scheduler',
    icon: '📅',
    schema: z.preprocess((raw) => {
      const c = raw && typeof raw === 'object' ? { ...(raw as any) } : {};

      // Aliases → canonical (just in case)
      if (Array.isArray(c.services) && !Array.isArray(c.service_ids)) c.service_ids = c.services;
      if (typeof c.default_service === 'string' && !c.default_service_id) {
        c.default_service_id = c.default_service;
      }

      // Safe defaults
      if (!Array.isArray(c.service_ids)) c.service_ids = [];
      if (typeof c.title !== 'string' || !c.title.trim()) c.title = 'Book an appointment';
      if (typeof c.subtitle !== 'string') c.subtitle = 'Choose a time that works for you';
      if (typeof c.show_resource_picker !== 'boolean') c.show_resource_picker = false;
      if (typeof c.timezone !== 'string' || !c.timezone) c.timezone = 'America/Los_Angeles';
      if (!Number.isFinite(Number(c.slot_granularity_minutes))) c.slot_granularity_minutes = 30;
      if (!Number.isFinite(Number(c.lead_time_minutes))) c.lead_time_minutes = 120;
      if (!Number.isFinite(Number(c.window_days))) c.window_days = 14;
      if (typeof c.confirmation_message !== 'string' || !c.confirmation_message) {
        c.confirmation_message = 'Thanks! Your appointment is confirmed.';
      }

      return c;
    }, z.object({
      title: z.string().min(1).default('Book an appointment'),
      subtitle: z.string().optional().default('Choose a time that works for you'),
      org_id: z.string().uuid().optional(),
      service_ids: z.array(z.string().uuid()).min(0).default([]),
      default_service_id: z.string().uuid().optional(),
      show_resource_picker: z.boolean().default(false),
      timezone: z.string().default('America/Los_Angeles'),
      slot_granularity_minutes: z.number().int().min(5).max(120).default(30),
      lead_time_minutes: z.number().int().min(0).max(1440).default(120),
      window_days: z.number().int().min(1).max(31).default(14),
      confirmation_message: z.string().default('Thanks! Your appointment is confirmed.'),
    })),
  },

  /* ───────────────────── ElectInfo: Candidate blocks ───────────────────── */

  candidate_hero: {
    label: 'Candidate Hero',
    icon: '🗳️',
    schema: z.object({
      photoUrl: z.string().url().nullish(),
      name: z.string().min(1),
      office: z.string().min(1),
      city: z.string().min(1),
      tagline: z.string().optional(),
      url: z.string().url(),               // canonical long URL
      shortUrl: z.string().url().optional(), // preferred for QR if present
      ctaDonateHref: z.string().url().optional(),
      ctaVolunteerHref: z.string().url().optional(),
      showDownloadQR: z.boolean().default(false),
    }),
  },

  candidate_about: {
    label: 'About Candidate',
    icon: '👤',
    schema: z.object({
      markdown: z.string(),                // plain markdown/HTML string
    }),
  },

  candidate_issues_grid: {
    label: 'Key Priorities',
    icon: '✅',
    schema: z.object({
      items: z.array(z.object({
        title: z.string(),
        desc: z.string(),
      })).min(1).max(12),
    }),
  },

  candidate_endorsements: {
    label: 'Endorsements',
    icon: '🗒️',
    schema: z.object({
      items: z.array(z.object({
        org: z.string(),
        quote: z.string(),
      })),
    }),
  },

  candidate_events: {
    label: 'Events',
    icon: '📅',
    schema: z.object({
      items: z.array(z.object({
        title: z.string(),
        dateISO: z.string(),               // ISO string; render can format
        venue: z.string(),
        blurb: z.string().optional(),
      })),
    }),
  },

  candidate_stay_connected: {
    label: 'Stay Connected',
    icon: '📬',
    schema: z.object({
      headline: z.string().default('Stay Connected'),
      showZip: z.boolean().default(true),
      candidateSlug: z.string(),           // passed to /api/subscribe
    }),
  },

  /* Admin-only utility block (self-hides on public routes) */
  candidate_print_qr: {
    label: 'Print & QR (Admin)',
    icon: '🖨️',
    schema: z.object({
      candidateSlug: z.string().min(1),
      name: z.string().default(''),
      longUrl: z.string().url(),
      shortUrl: z.string().url().optional(),
      captionMode: z.enum(['none','fromShort','custom']).default('fromShort'),
      customCaption: z.string().optional(),
      showStickerSheet: z.boolean().default(true),
      defaultPresetId: z.string().default('avery-5160'),
      showCutGuides: z.boolean().default(true),
      adminOnly: z.boolean().default(true),
    }),
  },
  candidate_donate: {
    label: 'Donate',
    icon: '💰',
    schema: z.object({
      headline: z.string().default('Donate to the Campaign'),
      description: z.string().optional(),
    }),
  },
  candidate_volunteer: {
    label: 'Volunteer',
    icon: '👥',
    schema: z.object({
      headline: z.string().default('Volunteer for the Campaign'),
      description: z.string().optional(),
    }),
  },
  /* Public-facing QR helpers */
  public_qr_info: {
    label: 'QR Info (Public)',
    icon: '🔗',
    schema: z.object({
      longUrl: z.string().url(),
      shortUrl: z.string().url().optional(),
      caption: z.string().optional(),
      size: z.number().min(64).max(512).default(112),
      align: z.enum(['left','center','right']).default('center'),
      showLinkText: z.boolean().default(true),
    }),
  },
  
  public_qr_sidebar: {
    label: 'QR Sidebar (Public)',
    icon: '🧲',
    schema: z.object({
      longUrl: z.string().url(),
      shortUrl: z.string().url().optional(),
      caption: z.string().optional(),
      size: z.number().min(80).max(220).default(128),
      side: z.enum(['left','right']).default('right'),
      sticky: z.boolean().default(true),
      topOffsetPx: z.number().min(0).max(200).default(24),
      hideOnMobile: z.boolean().default(true),
      breakpoint: z.enum(['md','lg','xl']).default('lg'),
      widthPx: z.number().min(160).max(420).default(260),
    }),
  },

} satisfies Record<string, { label: string; icon: string; schema: z.ZodTypeAny }>;

/* ─────────────── Type alias resolver (products-grid → products_grid, etc.) ───────────── */

const TYPE_ALIASES: Record<string, string> = {
  'products-grid': 'products_grid',
  'product-grid': 'products_grid',
  'products': 'products_grid',
  'service-scheduler': 'scheduler',
  // Prestige/exterior aliases → canonical renderer
  'exterior-agency': 'exterior_agency',
  'exterior-cleaning-agency': 'exterior_agency',
  'exterior_cleaning_agency': 'exterior_agency',
  'pnw_prestige': 'exterior_agency',


  // ElectInfo aliases
  'candidate-hero': 'candidate_hero',
  'candidate-about': 'candidate_about',
  'candidate-issues-grid': 'candidate_issues_grid',
  'candidate-endorsements': 'candidate_endorsements',
  'candidate-events': 'candidate_events',
  'candidate-stay-connected': 'candidate_stay_connected',
  'candidate-print-qr': 'candidate_print_qr',
  'public-qr-info': 'public_qr_info',
  'public-qr-sidebar': 'public_qr_sidebar',
  'candidate-qr-sidebar': 'public_qr_sidebar',
  'candidate-qr-info': 'public_qr_info',
  'candidate-qr-download': 'candidate_print_qr',
  'candidate-qr-sticker-sheet': 'candidate_print_qr',
  'candidate-qr-sticker-sheet-vector': 'candidate_print_qr',
  'candidate-qr-sticker-sheet-raster': 'candidate_print_qr',
  'candidate-qr-sticker-sheet-raster-vector': 'candidate_print_qr',
};

export function resolveCanonicalType(t: string): string {
  const k = String(t || '').trim();
  return TYPE_ALIASES[k] ?? k;
}

/* ─────────────────────────── Discriminated union ─────────────────────────── */

export function createBlockUnion<
  T extends Record<string, { label: string; icon: string; schema: z.ZodTypeAny }>
>(map: T) {
  const schemas: z.ZodDiscriminatedUnionOption<'type'>[] = [];
  const meta: Record<keyof T, { label: string; icon: string }> = {} as any;

  for (const [type, config] of Object.entries(map)) {
    schemas.push(
      z.object({
        type: z.literal(type),
        content: config.schema,
        _id: z.string().optional(),
        tone: z.string().optional(),
        industry: z.string().optional(),
        tags: z.array(z.string()).optional(),
        meta: z.record(z.any()).optional(),
      }) as z.ZodDiscriminatedUnionOption<'type'>
    );
    meta[type as keyof T] = { label: config.label, icon: config.icon };
  }
  return { schemas, meta };
}

const { schemas: BasicBlockSchemas, meta: blockMeta } =
  createBlockUnion(blockContentSchemaMap);

/**
 * Union schema with a preprocessor that:
 *  - maps alias types to canonical (e.g., products-grid → products_grid)
 *  - normalizes common product ID shapes at the top level (so unknown types don't fail)
 */
export const BlockSchema: z.ZodTypeAny = z.lazy(() =>
  z.preprocess(
    (raw) => {
      if (raw && typeof raw === 'object') {
        const b: any = { ...(raw as any) };

        if (typeof b.type === 'string') {
          const canon = resolveCanonicalType(b.type);
          if (canon !== b.type) b.type = canon;
        }

        // If products_grid, normalize keys early
        if (b.type === 'products_grid') {
          const cIn: any = b.content ?? b.props ?? {};
          const c: any = { ...cIn };

          if (Array.isArray(c.product_ids) && !Array.isArray(c.productIds)) c.productIds = c.product_ids;
          if (Array.isArray(c.ids) && !Array.isArray(c.productIds)) c.productIds = c.ids;
          if (Array.isArray(c.items) && !Array.isArray(c.productIds)) {
            c.productIds = c.items.map((x: any) => x?.id).filter(Boolean);
          }

          if (typeof c.columns === 'string') {
            const n = Number(c.columns);
            c.columns = Number.isFinite(n) ? n : c.columns;
          }

          b.content = c;
        }

        return b;
      }
      return raw;
    },
    z.discriminatedUnion(
      'type',
      BasicBlockSchemas as unknown as [
        z.ZodDiscriminatedUnionOption<'type'>,
        ...z.ZodDiscriminatedUnionOption<'type'>[]
      ]
    )
  )
);

export const BlocksArraySchema = z.array(BlockSchema);
export type Block = z.infer<typeof BlockSchema>;

/** Convenience export for scheduler block content type */
export type SchedulerBlock = z.infer<typeof blockContentSchemaMap['scheduler']['schema']>;

export function isValidBlock(data: unknown): data is Block {
  return BlockSchema.safeParse(data).success;
}

/* ─────────────────────────── Legacy migration helpers ─────────────────────── */

export function migrateLegacyBlock(block: any): any {
  if (!block || typeof block !== 'object') return block;

  if ('content' in block) {
    if (block.type === 'header' && block.content) {
      const c = block.content;
      if ('logoUrl' in c || 'navItems' in c) {
        block.content = {
          logo_url: c.logo_url ?? c.logoUrl ?? '',
          nav_items: c.nav_items ?? c.navItems ?? [],
        };
      }
    }
    if (block.type === 'footer' && block.content) {
      const c = block.content;
      if ('businessName' in c) {
        block.content = {
          business_name: c.business_name ?? c.businessName ?? '',
          address: c.address ?? '',
          cityState: c.cityState ?? '',
          phone: c.phone ?? '',
          links: c.links ?? [],
          logo_url: c.logo_url ?? c.logoUrl,
          social_links: c.social_links ?? c.socialLinks,
          copyright: c.copyright,
        };
      }
    }

    // NEW: migrate products-grid → products_grid + normalize ID keys
    if (block.type === 'products-grid') {
      const c = block.content ?? {};
      const ids =
        Array.isArray(c.product_ids) ? c.product_ids
        : Array.isArray(c.productIds) ? c.productIds
        : Array.isArray(c.ids) ? c.ids
        : Array.isArray(c.items) ? c.items.map((x: any) => x?.id).filter(Boolean)
        : [];
      block.type = 'products_grid';
      block.content = { ...c, productIds: ids, product_ids: ids };
    }

    // Alias: service-scheduler → scheduler
    if (block.type === 'service-scheduler') {
      block.type = 'scheduler';
    }

    return block;
  }

  if ('value' in block) {
    const val = (block as any).value;
    return { ...block, content: typeof val === 'string' ? { value: val } : val };
  }

  return block;
}

/* ───────────────────────────── Preview metadata ───────────────────────────── */

export const blockPreviewFallback: Record<Block['type'], string> = Object.entries(
  blockMeta as Record<Block['type'], { label: string; icon: string }>
).reduce((acc, [key, val]) => {
  acc[key as Block['type']] = `${val.icon} ${val.label}`;
  return acc;
}, {} as Record<Block['type'], string>);

export { blockMeta };

/* ───────────────────────────── Convenience defaults ───────────────────────── */

const HERO_DEFAULT_CONTENT = {
  headline: 'Welcome',
  subheadline: '',
  cta_text: '',
  cta_link: '/',
  image_url: '',
  layout_mode: 'inline',
  mobile_layout_mode: 'inline',
  mobile_crop_behavior: 'cover',
  image_position: 'center',
} as const;

/* ──────────────────────────── Full-schema helpers ─────────────────────────── */

function makeFullBlockSchema(type: string, content: z.ZodTypeAny) {
  return z.preprocess((raw) => {
    const b = raw && typeof raw === 'object' ? { ...(raw as any) } : (raw as any);

    if (!b || typeof b !== 'object') return raw;

    // Coerce legacy/seeded shape: props → content (also unwrap props.content if present)
    if (b.content == null && b.props && typeof b.props === 'object') {
      const p: any = b.props;
      b.content = (p && typeof p.content === 'object') ? p.content : p;
    }

    // Inject safe defaults where it helps pass first-save
    if (b.content == null) {
      if (type === 'hero') {
        b.content = { ...HERO_DEFAULT_CONTENT, ...(b.content ?? {}) };
      }
      if (type === 'scheduler') {
        b.content = {
          title: 'Book an appointment',
          subtitle: 'Choose a time that works for you',
          service_ids: [],
          show_resource_picker: false,
          timezone: 'America/Los_Angeles',
          slot_granularity_minutes: 30,
          lead_time_minutes: 120,
          window_days: 14,
          confirmation_message: 'Thanks! Your appointment is confirmed.',
          ...(b.content ?? {}),
        };
      }
    }

    return b;
  }, z.object({
    type: z.literal(type),
    content,
    _id: z.string().optional(),
    tone: z.string().optional(),
    industry: z.string().optional(),
    tags: z.array(z.string()).optional(),
    meta: z.record(z.any()).optional(),
  }));
}

export const blockFullSchemaMap: Record<string, z.ZodTypeAny> = Object.fromEntries(
  Object.entries(blockContentSchemaMap).map(([type, cfg]) => [type, makeFullBlockSchema(type, cfg.schema)])
);

for (const [type, cfg] of Object.entries(blockContentSchemaMap)) {
  const full = blockFullSchemaMap[type];
  // @ts-expect-error augment at runtime for convenience
  cfg.fullSchema = full;
  // @ts-expect-error allow validator-style usage
  cfg.safeParse = full.safeParse.bind(full);
}

export function schemaForBlockType(type: string): z.ZodTypeAny | null {
  return (blockContentSchemaMap as any)[type]?.schema ?? null;
}

export function schemaForBlockTypeFull(type: string): z.ZodTypeAny | null {
  return blockFullSchemaMap[type] ?? null;
}
