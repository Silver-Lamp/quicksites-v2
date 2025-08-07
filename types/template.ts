import { BlockValidationErrorMap } from '@/lib/validateBlock';
import type { Block } from './blocks';

export type Page = {
  id: string;
  slug: string;
  title: string;
  content_blocks: Block[];
  show_header?: boolean;
  show_footer?: boolean;
  site_id?: string | null;
  meta?: {
    title?: string;
    description?: string;
    visible?: boolean;
    theme?: string;
    ogImage?: string;
    faviconSizes?: string;
    appleIcons?: string;
  };
};

export type TemplateData = {
  pages?: Page[];
  services?: string[];
  testimonials?: string[];
  cta?: string[];
  faqs?: string[];
  contact_form?: string[];
  header?: string[];
  footer?: string[];
  service_areas?: string[];
  site_id?: string | null;
  phone?: string;
  color_mode?: 'light' | 'dark';
};

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
  pages?: Page[];

  headerBlock?: Block | null;
  footerBlock?: Block | null;
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
};

export type TemplateSnapshot = Snapshot;

export type Theme = 'light' | 'dark';
export type Brand = 'green' | 'blue' | 'purple' | 'red' | 'orange';
