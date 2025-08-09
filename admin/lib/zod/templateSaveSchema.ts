import { z } from 'zod';
import { BlockSchema } from './blockSchemas';
import { stringOrEmpty, nullableString } from './sharedHelpers';

// ─────────────────────────────────────
// 🔹 Slug Preprocessor
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}

// ─────────────────────────────────────
// 🔹 Page Schema

export const PageSchema = z.object({
  id: stringOrEmpty,
  title: z.string(),
  slug: z.string(),
  content_blocks: z.array(BlockSchema),
  show_header: z.boolean().optional().default(true),
  show_footer: z.boolean().optional().default(true),
});

// ─────────────────────────────────────
// 🔹 Base Template Schema (flattened)

export const TemplateSaveSchema = z
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
    claimed_by: z.string().nullable().optional(), // uuid
    claimed_at: z.string().nullable().optional(), // timestamp
    claim_source: z.string().nullable().optional(),
    archived: z.boolean().optional(),
    created_at: z.string().nullable().optional(), // timestamp
    updated_at: z.string().nullable().optional(), // timestamp
    template_name: z.string().min(1).default('untitled-template'),
    phone: nullableString,
    layout: z.string(),
    color_scheme: z.string(),
    color_mode: z.string().optional(),
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

    headerBlock: BlockSchema.optional().nullable(),
    footerBlock: BlockSchema.optional().nullable(),

    pages: z.array(PageSchema),
    services: z.array(z.string()).optional().default([]),

    verified: z.boolean().optional(),
    verified_at: z.string().nullable().optional(), // timestamp

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
  })
  .passthrough();
  // .strict();

export type ValidatedTemplate = z.infer<typeof TemplateSaveSchema>;
