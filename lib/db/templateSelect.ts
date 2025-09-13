// lib/db/templateSelect.ts
export const TEMPLATE_EDITOR_SELECT = `
  id, slug, base_slug, rev, updated_at,
  template_name,
  industry, industry_label,
  site_type, site_type_key, site_type_label,
  contact_email, phone,
  address_line1, address_line2, city, state, postal_code,
  latitude, longitude,
  color_mode, color_scheme, layout,
  data
`;
