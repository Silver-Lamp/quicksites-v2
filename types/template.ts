import { BlockValidationErrorMap } from '@/lib/validateBlock.js';
import type { Block } from './blocks.js';

export type Page = {
  id: string;
  slug: string;
  title: string;
  content_blocks: Block[];
  showHeader?: boolean;
  showFooter?: boolean;
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
  pages: Page[];
};

export type Snapshot = {
  id: string;
  template_name: string;
  layout: string;
  color_scheme: string;
  theme: string;
  brand: string;
  slug: string;
  industry: string;
  data: TemplateData;

  // 🆕 Global header/footer blocks
  headerBlock?: Block | null;
  footerBlock?: Block | null;

  block_errors?: BlockValidationErrorMap;
  block_errors_map?: Record<string, string[]>;
  commit?: string;
  created_at?: string;
  updated_at?: string;
  domain?: string | null;
  published?: boolean;
  archived?: boolean;
  name_exists?: boolean;
  show_name_error?: boolean;
  slug_preview?: string;
  input_value?: string;
  is_renaming?: boolean;
  is_creating?: boolean;
  autosave_status?: string;
  autosave_error?: string;
  autosave_message?: string;
  autosave_timestamp?: string;
  is_site?: boolean;
  verified?: boolean;
  custom_domain?: string;
  custom_domain_verified?: boolean;
  custom_domain_verification_token?: string;
  custom_domain_verification_token_expires_at?: string;
  custom_domain_verification_status?: string;
  custom_domain_verification_error?: string;
  custom_domain_verification_message?: string;
  custom_domain_verification_timestamp?: string;
  meta?: {
    title?: string;
    description?: string;
    ogImage?: string;
    faviconSizes?: string;
    appleIcons?: string;
  };
};

export type Template = Snapshot & {
  site_name?: string;
  template_name?: string;
  site_id?: string;
  headline?: string;
  description?: string;
  hero_url?: string;
  banner_url?: string;
  logo_url?: string;
  team_url?: string;
};

export type TemplateSnapshot = Snapshot;

export type Theme = 'light' | 'dark';
export type Brand = 'green' | 'blue' | 'purple' | 'red' | 'orange'; // Add more as needed
