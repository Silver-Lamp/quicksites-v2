// app/admin/templates/[[...slug]]/page.tsx
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { Template } from '@/types/template';

// Ensure no caching for edits
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type PageProps = {
  // In Next.js 15, params is async in the App Router
  params: Promise<{ slug?: string[] | string }>;
};

const STATIC_ASSET_RE =
  /\.(?:js\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|woff2?)$/i;

function safeParse(x: unknown) {
  if (typeof x !== 'string') return (x as any) ?? {};
  try {
    return JSON.parse(x);
  } catch {
    return {};
  }
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
  // Await params (Next.js 15)
  const p = await params;
  const parts = Array.isArray(p?.slug) ? p.slug : p?.slug ? [p.slug] : [];

  // Allow routes like /:key/edit or /:key/preview → strip trailing UI segment
  const last = parts[parts.length - 1];
  const cleaned =
    last && ['edit', 'preview', 'view'].includes(String(last).toLowerCase())
      ? parts.slice(0, -1)
      : parts;

  const key = cleaned.join('/');

  if (!key || STATIC_ASSET_RE.test(key)) return notFound();

  // Try to load a non-version draft first; fall back to latest matching row.
  const select =
    'id, template_name, slug, base_slug, data, header_block, footer_block, color_mode, domain, default_subdomain, is_version, is_site, updated_at, rev';
  const orCond = `id.eq.${key},slug.eq.${key},base_slug.eq.${key}`;

  // 1) Prefer non-version
  let row: any | null = null;
  {
    const { data, error } = await supabaseAdmin
      .from('templates')
      .select(select)
      .eq('is_version', false)
      .or(orCond)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (!error && data && data.length) row = data[0];
  }

  // 2) Fallback: any matching (e.g., when a fresh create has is_version=true)
  if (!row) {
    const { data, error } = await supabaseAdmin
      .from('templates')
      .select(select)
      .or(orCond)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (!error && data && data.length) row = data[0];
  }

  if (!row) return notFound();

  // Normalize DB row → Template shape expected by the editor
  const dataObj = safeParse(row.data);
  const headerObj = safeParse(row.header_block);
  const footerObj = safeParse(row.footer_block);

  if (row.header_block && !dataObj.headerBlock) dataObj.headerBlock = headerObj;
  if (row.footer_block && !dataObj.footerBlock) dataObj.footerBlock = footerObj;
  if (row.color_mode && !dataObj.color_mode) dataObj.color_mode = row.color_mode;

  const initialData = withSyncedPages({
    id: row.id,
    template_name: row.template_name ?? row.slug ?? 'Untitled',
    slug: row.slug ?? undefined,
    data: dataObj,
    headerBlock: headerObj ?? null,
    footerBlock: footerObj ?? null,
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
