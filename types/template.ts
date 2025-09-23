// types/template.ts
import { BlockValidationErrorMap } from '@/lib/validateBlock';
import type { Block } from './blocks';
import { z } from 'zod';
import { hoursOfOperationPropsSchema, type HoursOfOperationContent } from '@/admin/lib/zod/blockSchema';

/* ===========================
   Core domain types
   =========================== */

export type Page = {
  id: string;
  slug: string;
  title: string;

  // Content blocks for the page body only (no header/footer here)
  content_blocks: Block[];

  // Per-page visibility toggles for the global header/footer
  show_header?: boolean; // default true at render time
  show_footer?: boolean; // default true at render time

  // Optional per-page overrides (rare). If present and page is visible, these replace the global blocks.
  headerOverride?: Block | null;
  footerOverride?: Block | null;

  site_id?: string | null;
  meta?: {
    title?: string;
    description?: string;
    visible?: boolean;
    theme?: string;
    ogImage?: string;
    faviconSizes?: string;
    appleIcons?: string;

    // other page-scoped editor/runtime flags permitted via .passthrough() in zod
  };
};

export type TemplateData = {
  pages?: Page[];
  services?: string[];
  testimonials?: string[];
  cta?: string[];
  faqs?: string[];
  contact_form?: string[];
  header?: string[]; // legacy/unused in new model (kept for backward-compat)
  footer?: string[]; // legacy/unused in new model (kept for backward-compat)
  service_areas?: string[];
  site_id?: string | null;
  brand?: string;
  phone?: string;
  business_name?: string;
  contact_email?: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  industry?: string | null;
  color_mode?: 'light' | 'dark';
  archived?: boolean;
  headerBlock?: Block | null;
  footerBlock?: Block | null;
  hours?: HoursOfOperationContent | null;
  org_id?: string | null; 
  company_id?: string | null; 
};

export type TemplateInsert = Omit<Template,
  'id' | 'rev' | 'base_slug' | 'is_version' | 'created_at' | 'updated_at'
>;

// Represents the persisted state (matches DB + zod schema)
export type Snapshot = {
  id: string;
  template_name: string;
  slug: string;
  layout: string;
  color_scheme: string;
  theme: string;
  brand: string;
  commit?: string;
  industry: string;
  phone?: string;
  is_site?: boolean;
  published?: boolean;
  verified?: boolean;
  business_name?: string;
  contact_email?: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Some older records may still carry top-level pages; editor normalizes to data.pages
  pages?: Page[];

  // Legacy booleans; prefer per-page toggles going forward
  show_header?: boolean;
  show_footer?: boolean;

  hero_url?: string;
  banner_url?: string;
  logo_url?: string;
  team_url?: string;
  color_mode?: 'light' | 'dark';

  domain?: string | null;
  custom_domain?: string;
  default_subdomain?: string;

  created_at?: string;
  updated_at?: string;
  saved_at?: string;
  save_count?: number;
  last_editor?: string;
  owner_id?: string;

  claimed_by?: string;
  claimed_at?: string;
  claim_source?: string;

  search_engines_last_pinged_at?: string;
  search_engines_last_ping_response?: any;

  services?: string[];
  site_id?: string | null;
  meta?: {
    title?: string;
    description?: string;
    ogImage?: string;
    faviconSizes?: string;
    appleIcons?: string;
  };

  data?: TemplateData;

  // 🔹 Single source of truth for site-wide chrome
  headerBlock?: Block | null;
  footerBlock?: Block | null;
  org_id?: string | null;
  company_id?: string | null; 
};

// Editor/runtime-only properties go here
export type Template = Snapshot & {
  site_name?: string;
  headline?: string;
  description?: string;
  name_exists?: boolean;
  show_name_error?: boolean;
  slug_preview?: string;
  input_value?: string;
  is_renaming?: boolean;
  is_creating?: boolean;

  // Autosave feedback
  autosave_status?: string;
  autosave_error?: string;
  autosave_message?: string;
  autosave_timestamp?: string;

  // Block diagnostics
  block_errors?: BlockValidationErrorMap;
  block_errors_map?: Record<string, string[]>;
  hours?: HoursOfOperationContent | null;

  industry_label?: string;
  industry_other?: string;
  site_type?: string;
  contact_email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  org_id?: string | null; 
  company_id?: string | null; 
};

export type TemplateSnapshot = Snapshot;

export type Theme = 'light' | 'dark';
export type Brand = 'green' | 'blue' | 'purple' | 'red' | 'orange';

/* ===========================
   Zod schemas (editor-friendly)
   =========================== */

const UUID = z.string().uuid().nullable().optional();
const BlockSchema = z.any(); // editor: allow any block shape

const PageSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),

    // body content only
    content_blocks: z.array(BlockSchema),

    // per-page visibility toggles
    show_header: z.boolean().optional(),
    show_footer: z.boolean().optional(),

    // optional per-page overrides (nullable + optional)
    headerOverride: BlockSchema.nullable().optional(),
    footerOverride: BlockSchema.nullable().optional(),

    site_id: UUID,
    meta: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        visible: z.boolean().optional(),
        theme: z.string().optional(),
        ogImage: z.string().optional(),
        faviconSizes: z.string().optional(),
        appleIcons: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough(); // allow page extensions

const TemplateDataSchema = z
  .object({
    pages: z.array(PageSchema).optional(),
    services: z.array(z.string()).optional(),
    testimonials: z.array(z.string()).optional(),
    cta: z.array(z.string()).optional(),
    faqs: z.array(z.string()).optional(),
    contact_form: z.array(z.string()).optional(),
    header: z.array(z.string()).optional(), // legacy
    footer: z.array(z.string()).optional(), // legacy
    service_areas: z.array(z.string()).optional(),
    business_name: z.string().optional(),
    contact_email: z.string().optional(),
    owner_id: UUID,
    site_id: UUID,
    brand: z.string().optional(),
    phone: z.string().optional(),
    color_mode: z.enum(['light', 'dark']).optional(),
    archived: z.boolean().optional(),
    address_line1: z.string().optional(),
    address_line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    industry: z.string().optional(),
    hours: hoursOfOperationPropsSchema.optional(),
    org_id: UUID, 
    company_id: UUID, 
  })
  .passthrough(); // accept extra keys inside data

// Core template shape used by the editor; intentionally permissive.
export const TemplateFormSchema = z
  .object({
    id: z.string().uuid(),
    template_name: z.string(),
    slug: z.string(),
    layout: z.string(),
    color_scheme: z.string(),
    theme: z.string(),
    brand: z.string(),
    business_name: z.string().optional(),
    contact_email: z.string().optional(),
    industry: z.string().optional(),
    phone: z.string().optional(),
    is_site: z.boolean().optional(),
    published: z.boolean().optional(),
    verified: z.boolean().optional(),
    address_line1: z.string().optional(),
    address_line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    // editor can carry both top-level pages and data.pages
    pages: z.array(PageSchema).optional(),

    // legacy booleans (kept for compatibility)
    show_header: z.boolean().optional(),
    show_footer: z.boolean().optional(),

    hero_url: z.string().optional(),
    banner_url: z.string().optional(),
    logo_url: z.string().optional(),
    team_url: z.string().optional(),
    color_mode: z.enum(['light', 'dark']).optional(),

    // DB-ish fields (allowed, not enforced)
    domain: z.string().nullable().optional(),
    custom_domain: z.string().optional(),
    default_subdomain: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    saved_at: z.string().optional(),
    save_count: z.number().optional(),
    last_editor: z.string().optional(),
    claimed_by: z.string().optional(),
    claimed_at: z.string().optional(),
    claim_source: z.string().optional(),
    search_engines_last_pinged_at: z.string().optional(),
    search_engines_last_ping_response: z.any().optional(),
    services: z.array(z.string()).optional(),
    owner_id: UUID,
    site_id: UUID,

    meta: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        ogImage: z.string().optional(),
        faviconSizes: z.string().optional(),
        appleIcons: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),

    data: TemplateDataSchema.optional(),

    // 🔹 Global header/footer (single source of truth)
    headerBlock: BlockSchema.nullable().optional(),
    footerBlock: BlockSchema.nullable().optional(),
    hours: hoursOfOperationPropsSchema.optional(),
    org_id: UUID, 
    company_id: UUID, 
  })
  .passthrough(); // accept unknown top-level keys

export type TemplateForm = z.infer<typeof TemplateFormSchema>;
