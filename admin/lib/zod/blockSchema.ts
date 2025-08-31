// admin/lib/zod/blockSchema.ts
import { z } from 'zod';

// Allow http(s)://, /relative, #anchor, mailto:, tel:
const RelativeOrAbsoluteUrl = z.string().min(1).refine(
  (v) => /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(v),
  { message: 'Link must start with http(s)://, /, #, mailto:, or tel:' }
);

const urlOptional = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().url('Kitchen video URL must be valid').optional()
);

/* ───────────────────────────── Hours of Operation ───────────────────────────── */

export const hoursOfOperationPropsSchema = z.object({
  title: z.string().optional(),
  tz: z.string().optional(),
  alwaysOpen: z.boolean().optional(),
  note: z.string().optional(),
  display_style: z.enum(['table', 'stack']).optional(),
  days: z.array(z.object({
    key: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
    label: z.string(),
    closed: z.boolean(),
    periods: z.array(z.object({
      open: z.string(),
      close: z.string()
    })).optional(),
  })).optional(),
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

export function defaultHoursContent(partial?: Partial<HoursOfOperationContent>): HoursOfOperationContent {
  const baseDays: HoursOfOperationContent['days'] = [
    { key: 'mon', label: 'Mon', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'tue', label: 'Tue', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'wed', label: 'Wed', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'thu', label: 'Thu', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'fri', label: 'Fri', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
    { key: 'sat', label: 'Sat', closed: true,  periods: [] },
    { key: 'sun', label: 'Sun', closed: true,  periods: [] },
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
  days: z.array(z.object({
    key: z.enum(['mon','tue','wed','thu','fri','sat','sun']),
    label: z.string(),
    closed: z.boolean(),
    periods: z.array(HoursPeriodSchema),
  })),
  exceptions: z.array(SpecialHoursSchema).optional(),
});

/* ───────────────────────────── Shared Link schema ──────────────────────────── */

const LinkSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  href: RelativeOrAbsoluteUrl.default('/'),
  appearance: z.string().optional(),
});

/* ─────────────────────────────── Text Block ────────────────────────────────── */

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

/* ─────────────────────────── Meals/Reviews helpers ─────────────────────────── */

const emptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(v => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

export const mealCardPropsSchema = z.object({
  mealId:  emptyToUndef(z.string().uuid()).optional(),
  mealSlug: emptyToUndef(z.string().min(1)).optional(),
  showPrice: z.boolean().default(true),
  showChef: z.boolean().default(false),
  showRating: z.boolean().default(true),
  showTags: z.boolean().default(true),
  ctaText: z.string().default("View meal"),
  variant: z.enum(["default","compact","hero"]).default("default"),
}).refine(p => !!p.mealId || !!p.mealSlug, {
  message: "Provide mealId or mealSlug",
  path: ["mealSlug"],
});

export const reviewsListPropsSchema = z.object({
  mealId:  emptyToUndef(z.string().uuid()).optional(),
  chefId:  emptyToUndef(z.string().uuid()).optional(),
  siteId:  emptyToUndef(z.string().uuid()).optional(),
  pageSize: z.number().int().min(1).max(50).default(6),
  sort: z.enum(["recent","top"]).default("recent"),
  minStars: z.preprocess(
    v => (v === 0 || v === "0" || v === "" ? undefined : v),
    z.number().int().min(1).max(5)
  ).optional(),
  showSummary: z.boolean().default(true),
  showWriteCta: z.boolean().default(false),
}).refine(p => !!p.mealId || !!p.chefId || !!p.siteId, {
  message: "Provide mealId, chefId, or siteId",
  path: ["siteId"],
});

export const mealsGridPropsSchema = z.object({
  siteSlug: emptyToUndef(z.string().min(1)).optional(),
  siteId: emptyToUndef(z.string().uuid()).optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["recent","rating","price_asc","price_desc","popular"]).default("recent"),
  limit: z.number().int().min(1).max(48).default(12),
  columns: z.number().int().min(1).max(6).default(3),
  ctaText: z.string().default("View meal"),
}).refine(p => !!p.siteSlug || !!p.siteId, { message: "Provide siteSlug or siteId" });

/* ─────────────────────────── Header / Footer blocks ────────────────────────── */

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

const REL = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

const FooterContent = z.preprocess((raw) => {
  const c = (raw && typeof raw === 'object') ? { ...(raw as any) } : {};

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

/* ───────────────────── Chef profile (legacy coercion) ─────────────────────── */

const ChefMealBase = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Meal name is required'),
  description: z.string().optional().default(''),
  price: z.string().min(1, 'Meal price is required'),
  availability: z.string().min(1, 'Meal availability is required'),
  image_url: z.string().url('Meal image URL must be valid'),
});

const ChefMealSchema = z.preprocess((val) => {
  if (val && typeof val === 'object' && !('name' in (val as any)) && 'title' in (val as any)) {
    const v = val as any;
    return { ...v, name: v.title };
  }
  return val;
}, ChefMealBase);

/* ───────────────────────────── Block schema map ────────────────────────────── */

export const blockContentSchemaMap = {
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
    schema: z.object({
      headline: z.string().min(1),
      subheadline: z.string().optional(),
      cta_text: z.string().optional(),
      cta_link: z.string().optional(),
      image_url: z.union([z.string().url(), z.literal('')]).optional(),
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
    }),
  },

  /* UPDATED: services matches seeded props (objects), plus optional title/columns */
  services: {
    label: 'Services',
    icon: '🧰',
    schema: z.object({
      title: z.string().optional(),
      columns: z.number().int().min(1).max(6).default(3),
      items: z.array(z.object({
        name: z.string().min(1),
        description: z.string().default(''),
        // allow "$123", "From $99", or omit entirely
        price: z.string().optional(),
        href: z.string().optional(),
        icon: z.string().optional(),
      })).min(1),
    }),
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
      let allCities = Array.isArray(c.allCities)
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
      provider: z.enum(['spotify','soundcloud','suno']),
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

  meal_card: { label: 'Meal Card', icon: '🍽️', schema: mealCardPropsSchema },
  reviews_list: { label: 'Reviews List', icon: '⭐', schema: reviewsListPropsSchema },

  chef_profile: {
    label: 'Chef Profile',
    icon: '👨‍🍳',
    schema: z.object({
      name: z.string().min(1),
      location: z.string().min(1),
      profile_image_url: z.string().url('Profile image URL must be valid'),
      kitchen_video_url: urlOptional,
      bio: z.string().min(1),
      certifications: z.array(z.string().min(1)).min(1),
      meals: z.array(ChefMealSchema).min(1),
    }),
  },

  meals_grid: { label: 'Meals Grid', icon: '🍱', schema: mealsGridPropsSchema },

  hours: { label: 'Hours of Operation', icon: '⏰', schema: HoursOfOperationSchema },
} satisfies Record<string, { label: string; icon: string; schema: z.ZodTypeAny }>;

/* ─────────────────────────── Discriminated union ──────────────────────────── */

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

const { schemas: BasicBlockSchemas, meta: blockMeta } = createBlockUnion(blockContentSchemaMap);

export const BlockSchema: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion(
    'type',
    BasicBlockSchemas as unknown as [
      z.ZodDiscriminatedUnionOption<'type'>,
      ...z.ZodDiscriminatedUnionOption<'type'>[]
    ]
  )
);

export const BlocksArraySchema = z.array(BlockSchema);
export type Block = z.infer<typeof BlockSchema>;

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
    if (block.type === 'chef_profile' && Array.isArray(block.content?.meals)) {
      block.content.meals = block.content.meals.map((m: any, idx: number) => ({
        id: m?.id,
        name: m?.name ?? m?.title ?? `Meal ${idx + 1}`,
        description: typeof m?.description === 'string' ? m.description : '',
        price: m?.price ?? '',
        availability: m?.availability ?? '',
        image_url: m?.image_url ?? '',
      }));
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

/* ───────────────────────────── Convenience helper ─────────────────────────── */

/** Return the content/props Zod schema for a given block type (or null). */
export function schemaForBlockType(type: string): z.ZodTypeAny | null {
  return (blockContentSchemaMap as any)[type]?.schema ?? null;
}
