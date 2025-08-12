// admin/lib/saveAsTemplate.ts
import { supabase } from '@/admin/lib/supabaseClient';
import { cleanTemplateDataStructure } from './cleanTemplateData';
import type { Template } from '@/types/template';

type SaveResult = { id: string; slug: string } | null;

function slugify(str: string) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}

function shortId() {
  return Math.random().toString(36).slice(2, 6);
}

export async function saveAsTemplate(
  template: Partial<Template> & Record<string, any>,
  type: 'template' | 'site'
): Promise<SaveResult> {
  const baseName = template.template_name || template.slug || 'untitled';
  const newName = `Copy of ${baseName}`;

  // Clean editor payload first
  const cleaned = cleanTemplateDataStructure(template);

  // Ensure header/footer live inside data (NOT at top-level columns)
  // Prefer explicit template.headerBlock/footerBlock, then any legacy in data
  const finalData = {
    ...(template.data ?? {}),
    ...(cleaned?.data ?? cleaned),
    headerBlock:
      template.headerBlock ??
      (template.data as any)?.headerBlock ??
      null,
    footerBlock:
      template.footerBlock ??
      (template.data as any)?.footerBlock ??
      null,
  };

  // Build a compact, unique-ish slug; retry on unique-violation
  const baseSlug = slugify(template.slug || template.template_name || 'copy');
  const seed = `${type}-${shortId()}`;
  const makeSlug = (attempt: number) =>
    [baseSlug, seed, attempt ? shortId() : ''].filter(Boolean).join('-').slice(0, 80);

  // Only columns that exist on `templates`
  const commonPayload = {
    template_name: `${newName} (${type})`,
    layout: template.layout ?? 'standard',
    color_scheme: template.color_scheme ?? 'neutral',
    theme: template.theme ?? 'default',
    brand: template.brand ?? 'default',
    industry: template.industry ?? 'general',
    commit: '',
    phone: template.phone ?? null,
    data: finalData,
    is_site: type === 'site',
    published: false,
    verified: false,
    color_mode: (template as any)?.color_mode ?? (template.data as any)?.color_mode ?? null,
    domain: null,
    custom_domain: null,
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    const candidateSlug = makeSlug(attempt);

    const { data, error } = await supabase
      .from('templates')
      .insert([{ ...commonPayload, slug: candidateSlug }])
      .select('id, slug')
      .single();

    if (!error && data) return { id: data.id, slug: data.slug };

    const msg = (error as any)?.message || '';
    const code = (error as any)?.code || '';
    const unique = code === '23505' || /duplicate key|unique/i.test(msg);
    if (!unique) {
      console.error('Failed to save copy:', error);
      return null;
    }
    // retry with a fresh suffix
  }

  console.error('Failed to save copy: exceeded retry attempts for unique slug.');
  return null;
}
