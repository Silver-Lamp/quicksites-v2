// app/admin/templates/[[...slug]]/page.tsx
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { Template } from '@/types/template';

type PageProps = {
  params: { slug?: string[] };
};

const STATIC_ASSET_RE = /\.(?:js\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|woff2?)$/i;

function safeParse(x: unknown) {
  if (typeof x !== 'string') return (x as any) ?? {};
  try { return JSON.parse(x); } catch { return {}; }
}

function coalescePages(obj: any): any[] {
  if (Array.isArray(obj?.data?.pages)) return obj.data.pages;
  if (Array.isArray(obj?.pages)) return obj.pages;
  return [];
}

function withSyncedPages<T extends { data?: any; pages?: any[] }>(tpl: T): T {
  const pages = coalescePages(tpl);
  return { ...tpl, pages, data: { ...(tpl.data ?? {}), pages } } as T;
}

export default async function TemplateEditPage({ params }: PageProps) {
  const key = Array.isArray(params.slug) ? params.slug.join('/') : params.slug ?? '';
  if (!key || STATIC_ASSET_RE.test(key)) return notFound();

  // Load a non-version draft by id OR slug OR base_slug
  const select =
    'id, template_name, slug, base_slug, data, header_block, footer_block, color_mode, domain, default_subdomain, is_version, is_site';

  const { data: row, error } = await supabaseAdmin
    .from('templates')
    .select(select)
    .eq('is_version', false)
    .or(`id.eq.${key},slug.eq.${key},base_slug.eq.${key}`)
    .maybeSingle();

  if (error || !row) return notFound();

  // Normalize row → Template the editor expects
  const dataObj = safeParse(row.data);
  if (row.header_block && !dataObj.headerBlock) dataObj.headerBlock = row.header_block;
  if (row.footer_block && !dataObj.footerBlock) dataObj.footerBlock = row.footer_block;
  if (row.color_mode && !dataObj.color_mode) dataObj.color_mode = row.color_mode;

  const initialData = withSyncedPages({
    id: row.id,
    template_name: row.template_name ?? row.slug ?? 'Untitled',
    slug: row.slug ?? undefined,
    data: dataObj,
    headerBlock: row.header_block ?? null,
    footerBlock: row.footer_block ?? null,
    color_mode: (row.color_mode as 'light' | 'dark' | undefined) ?? 'light',
    domain: row.domain ?? undefined,
    default_subdomain: row.default_subdomain ?? undefined,
    is_site: !!row.is_site,
  } as Template);

  const colorMode = (initialData.color_mode as 'light' | 'dark') ?? 'light';

  return (
    <TemplateEditorProvider
      templateName={initialData.template_name}
      colorMode={colorMode}
      initialData={initialData}
    >
      <TemplateEditor
        templateName={initialData.template_name}
        initialData={initialData}
        initialMode={initialData.is_site ? 'site' : 'template'}
        colorMode={colorMode}
      />
    </TemplateEditorProvider>
  );
}
