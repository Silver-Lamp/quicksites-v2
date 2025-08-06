// admin/utils/ensureValidTemplateFields.ts
import type { Template } from '@/types/template';
import { generateSlug } from '@/lib/utils/generateSlug';
import { ensureBlockId } from '@/admin/lib/ensureBlockId';

export function ensureValidTemplateFields(
  template: Partial<Template>,
  options?: { lastEditorId?: string }
): Template {
  const now = new Date().toISOString();

  const generateUniqueSlug = (base: string) =>
    `${generateSlug(base)}-${Math.random().toString(36).slice(2, 6)}`;

  const validId =
    template.id && template.id !== 'undefined' && template.id !== ''
      ? template.id
      : crypto.randomUUID();

  const validSlug =
    template.slug && template.slug !== 'undefined' && template.slug !== ''
      ? template.slug
      : generateUniqueSlug(template.template_name || 'template');

  const validTemplateName =
    template.template_name && template.template_name !== 'undefined'
      ? template.template_name
      : validSlug; // 👈 now mirrors slug to avoid collision
    
  const validSiteId =
    template.site_id && template.site_id !== 'undefined' && template.site_id !== ''
      ? template.site_id
      : undefined;

  const stripBlockIds = (template.data?.pages || []).map((page) => ({
    ...page,
    content_blocks: page.content_blocks.map((block) => {
      const { _id, ...cleaned } = ensureBlockId(block);
      return cleaned;
    }),
  }));

  return {
    ...template,
    id: validId,
    slug: validSlug,
    site_id: validSiteId,
    template_name: validTemplateName,
    created_at: template.created_at || now,
    updated_at: now,
    saved_at: now,
    phone: template.phone || template.data?.phone || '',
    save_count: (template as any).save_count ? (template as any).save_count + 1 : 1,
    last_editor: options?.lastEditorId || (template as any).last_editor || '',
    verified: typeof template.verified === 'boolean' ? template.verified : false,
    industry: template.industry || 'general',
    domain: template.domain || '',
    custom_domain: template.custom_domain || '',
    default_subdomain: `${validSlug}.quicksites.ai`,
    meta: {
      title: template.meta?.title || validTemplateName,
      description:
        template.meta?.description || 'Auto-generated template description',
      ogImage: template.meta?.ogImage || '',
      faviconSizes: template.meta?.faviconSizes || '',
      appleIcons: template.meta?.appleIcons || '',
      ...template.meta,
    },
    data: {
      ...template.data,
      services: template.data?.services || [],
      pages: stripBlockIds,
    },
  } as Template;
}
