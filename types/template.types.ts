export type TemplateEntry = {
  id: string;
  template_name: string;
  industry: string;
  layout: string;
  color_scheme: string;
  data: any; // consider replacing with TemplateSchema type if available
  created_at: string; // or Date
  updated_at: string; // or Date
  domain: string | null;
  published: boolean;
  custom_domain: string | null;
  is_site: boolean;
  phone: string | null;
};
