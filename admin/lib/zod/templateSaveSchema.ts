import { z } from 'zod';
import { BlockSchema } from './blockSchemas';
import { stringOrEmpty, nullableString } from './sharedHelpers';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}

export const PageSchema = z.object({
  id: stringOrEmpty,
  title: z.string(),
  slug: z.string(),
  content_blocks: z.array(BlockSchema),
  show_header: z.boolean().optional().default(true),
  show_footer: z.boolean().optional().default(true),
});

export const TemplateDataSchema = z
  .object({
    pages: z.array(PageSchema),
    services: z.array(z.string()).optional().default([]),
  })
  .strict();

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
    template_name: z.string().min(1).default('untitled-template'),
    phone: stringOrEmpty,
    layout: z.string(),
    color_scheme: z.string(),
    color_mode: z.string().optional(),
    industry: z.string().default('General'),
    theme: z.string(),
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

    data: TemplateDataSchema,

    updated_at: z.string().optional(),
    verified: z.boolean().optional(),
    services: z.array(z.string()).optional().default([]),

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
  .transform((obj) => {
    const { pages, services, ...rest } = obj as any;
    return rest;
  });

export type ValidatedTemplate = z.infer<typeof TemplateSaveSchema>;
