// admin/lib/zod/templateSaveSchema.ts
import { z } from 'zod';
import { BlockSchema } from './blockSchema';
import { stringOrEmpty, nullableString } from './sharedHelpers';

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').trim();
}

// Treat null/"" as undefined for optional string-ish fields
const nullToUndefString = z.preprocess(
  (v) => (v === null || v === '' ? undefined : v),
  z.string().optional()
);

// ─────────────────────────────────────
// Page schema

export const PageSchema = z.object({
  id: stringOrEmpty,
  title: z.string(),
  slug: z.string(),
  content_blocks: z.array(BlockSchema),
  show_header: z.boolean().optional().default(true),
  show_footer: z.boolean().optional().default(true),
});

const PagesArray = z.array(PageSchema);

// Allow legacy: pages as a JSON string
const CoercePages = z.preprocess((val) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return val;
}, PagesArray);

// Always return an object so we don’t hand undefined to z.object
const hoistPagesFromData = (raw: unknown) => {
  const t: any =
    raw && typeof raw === 'object'
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (!t.pages && Array.isArray(t?.data?.pages)) t.pages = t.data.pages;
  return t;
};

// ─────────────────────────────────────
// Template save schema
// NOTE: .passthrough() is on the INNER z.object(...), not after preprocess!

export const TemplateSaveSchema = z.preprocess(
  hoistPagesFromData,
  z
    .object({
      id: z.string().optional(),

      slug: z.preprocess(
        (val) => (typeof val === 'string' ? slugify(val) : ''),
        z
          .string()
          .min(1, 'Slug is required')
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'Slug must be lowercase, alphanumeric, and hyphen-separated',
          })
      ),

      site_id: z.string().nullable().optional(),
      editor_id: z.string().nullable().optional(),

      // null/"" tolerated and treated as undefined (prevents Zod errors during rename/duplicate)
      claimed_by: nullToUndefString,
      claimed_at: nullToUndefString,
      claim_source: nullToUndefString,

      archived: z.boolean().optional(),
      created_at: z.string().nullable().optional(),
      updated_at: z.string().nullable().optional(),

      template_name: z.string().min(1).default('untitled-template'),
      phone: nullableString,
      layout: z.string(),
      color_scheme: z.string(),
      color_mode: z.enum(['light', 'dark']).optional().default('light'),
      industry: z.string().default('General'),
      theme: z.string(),
      brand: nullableString,
      commit: nullableString,
      saved_at: nullableString,
      save_count: z.number().nullable().optional(),
      last_editor: nullableString,
      default_subdomain: nullableString,

      is_site: z.boolean().optional(),
      published: z.boolean().optional(),
      headline: z.string().optional(),
      description: z.string().optional(),
      hero_url: nullableString,
      banner_url: nullableString,
      logo_url: nullableString,
      team_url: nullableString,

      // Optional header/footer blocks (top-level mirror)
      headerBlock: BlockSchema.optional().nullable(),
      footerBlock: BlockSchema.optional().nullable(),

      // Was required; now optional + legacy string allowed
      pages: CoercePages.optional().default([]),

      services: z.array(z.string()).optional().default([]),

      // Verification fields (present in your data model)
      verified: z.boolean().optional(),
      verified_at: z.string().nullable().optional(),

      meta: z.preprocess(
        (val) => (val === null ? {} : val),
        z
          .object({
            title: z.string().optional(),
            description: z.string().optional(),
            ogImage: z.string().optional(),
            faviconSizes: z.string().optional(),
            appleIcons: z.string().optional(),
          })
          .optional()
      ),

      // Canonical editor payload
      data: z
        .object({
          pages: PagesArray.optional(),
          meta: z.any().optional(),
          // allow chrome + common fields inside data
          headerBlock: BlockSchema.optional().nullable(),
          footerBlock: BlockSchema.optional().nullable(),
          color_mode: z.enum(['light', 'dark']).optional(),
          phone: nullableString.optional(),
        })
        .partial()
        .optional(),
    })
    .passthrough()
);

export type ValidatedPage = z.infer<typeof PageSchema>;
export type ValidatedTemplate = z.infer<typeof TemplateSaveSchema>;
