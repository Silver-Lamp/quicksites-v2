// app/sites/[slug]/[[...rest]]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import SiteRenderer from '@/components/sites/site-renderer';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';
import CartPageClient from '@/components/cart/CartPageClient';
import CheckoutPageClient from '@/components/cart/CheckoutPageClient';
import ThankYouPageClient from '@/components/cart/ThankYouPageClient';

/* -------------------- Types -------------------- */
type SiteRow = {
  id: string;
  slug: string | null;
  domain: string | null;
  template_id: string | null;
  published_snapshot_id: string | null;
};

type SnapshotRow = {
  id: string;
  template_id: string;
  rev: number;
  data: Record<string, any>;
  hash?: string | null;
  assets_resolved?: Record<string, any>;
  created_at?: string | null;
};

type RenderSite = {
  id: string;
  slug: string | null;
  template_name: string | null;
  domain: string | null;
  default_subdomain?: string | null;
  color_mode: 'light' | 'dark';
  pages: any[];
  headerBlock: any | null;
  footerBlock: any | null;
  data: any;
};

/* -------------------- Helpers -------------------- */
async function originFromHeaders() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000')
    .toLowerCase()
    .replace(/\.$/, '');
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function firstPageSlug(site: { data?: any; pages?: any[] }) {
  const pages = Array.isArray((site as any)?.pages)
    ? (site as any).pages
    : ((site as any)?.data?.pages ?? []);
  const first = Array.isArray(pages) ? pages.find((p: any) => p?.slug) ?? pages[0] : null;
  return (first?.slug as string) || 'home';
}

function normalizeForRenderer(
  snapshotData: any,
  siteFields: Pick<SiteRow, 'id'|'slug'|'domain'> & { default_subdomain?: string | null }
): RenderSite {
  const data = snapshotData ?? {};
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const headerBlock = data?.headerBlock ?? data?.header ?? null;
  const footerBlock = data?.footerBlock ?? data?.footer ?? null;
  const color_mode = (data?.meta?.theme === 'dark' ? 'dark' : data?.color_mode) ?? 'light';
  const template_name = data?.meta?.siteTitle ?? siteFields.slug ?? null;

  return {
    id: siteFields.id,
    slug: siteFields.slug,
    template_name,
    domain: siteFields.domain,
    default_subdomain: siteFields.default_subdomain ?? null,
    color_mode,
    pages,
    headerBlock,
    footerBlock,
    data,
  };
}

function safeParse(x: any) {
  if (typeof x !== 'string') return x ?? {};
  try { return JSON.parse(x); } catch { return {}; }
}

/* ----------------- Data access ------------------ */
async function loadSiteRowBySlug(slug: string): Promise<SiteRow | null> {
  const { data, error } = await supabaseAdmin
    .from('sites')
    .select('id, slug, domain, template_id, published_snapshot_id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.warn('[sites] lookup by slug failed:', error.message);
    return null;
  }
  return (data as SiteRow) ?? null;
}

async function loadSnapshotById(id: string): Promise<SnapshotRow | null> {
  const { data, error } = await supabaseAdmin
    .from('snapshots')
    .select('id, template_id, data, hash, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn('[snapshots] lookup failed:', error.message);
    return null;
  }
  return (data as SnapshotRow) ?? null;
}

async function loadDraftTemplate(templateId: string): Promise<{ data: any; siteFields: any } | null> {
  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('id, slug, template_name, data, header_block, footer_block, color_mode, domain')
    .eq('id', templateId)
    .maybeSingle();
  if (error) {
    console.warn('[templates] draft meta lookup failed:', error.message);
    return null;
  }
  const d = safeParse(data?.data) ?? {};
  if (data?.header_block && !d?.headerBlock) d.headerBlock = data.header_block;
  if (data?.footer_block && !d?.footerBlock) d.footerBlock = data.footer_block;
  if (data?.color_mode && !d?.color_mode) d.color_mode = data.color_mode;

  return {
    data: d,
    siteFields: {
      id: data!.id,
      slug: data!.slug,
      domain: data!.domain,
      default_subdomain: null,
    },
  };
}

async function isAdminUser(userId: string | null) {
  if (!userId) return false;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/* -------------------- Metadata -------------------- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; rest?: string[] }>;
}): Promise<Metadata> {
  const { slug, rest } = await params;

  // Lightweight metadata for special routes
  if (rest?.[0] === 'cart') return { title: 'Cart' };
  if (rest?.[0] === 'checkout') return { title: 'Checkout' };
  if (rest?.[0] === 'thank-you') return { title: 'Thank you' };

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = await isAdminUser(user?.id ?? null);

  const siteRow = await loadSiteRowBySlug(slug);
  if (!siteRow) return {};

  let snapshotData: any | null = null;
  if (siteRow.published_snapshot_id) {
    const snap = await loadSnapshotById(siteRow.published_snapshot_id);
    snapshotData = snap?.data ?? null;
  } else if (admin && siteRow.template_id) {
    const draft = await loadDraftTemplate(siteRow.template_id);
    snapshotData = draft?.data ?? null;
  }
  if (!snapshotData) return {};

  const normalized = normalizeForRenderer(snapshotData, {
    id: siteRow.id, slug: siteRow.slug, domain: siteRow.domain, default_subdomain: null,
  });

  const pageSlug = rest?.[0] ?? firstPageSlug(normalized);
  return generatePageMetadata({
    site: normalized as any,
    pageSlug,
    baseUrl: `${await originFromHeaders()}/sites`,
  });
}

/* ---------------------- Page ---------------------- */
export default async function SitePreviewPage({
  params,
}: {
  params: Promise<{ slug: string; rest?: string[] }>;
}) {
  const { slug, rest } = await params;

  // Special routes served directly
  if (Array.isArray(rest)) {
    if (rest[0] === 'cart') return <CartPageClient />;
    if (rest[0] === 'checkout') return <CheckoutPageClient />;
    if (rest[0] === 'thank-you') return <ThankYouPageClient />;
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = await isAdminUser(user?.id ?? null);

  const siteRow = await loadSiteRowBySlug(slug);
  if (!siteRow) return notFound();

  // Prefer published snapshot, else (admins only) fall back to live draft
  let normalized: RenderSite | null = null;

  if (siteRow.published_snapshot_id) {
    const snap = await loadSnapshotById(siteRow.published_snapshot_id);
    if (snap?.data) {
      normalized = normalizeForRenderer(snap.data, {
        id: siteRow.id,
        slug: siteRow.slug,
        domain: siteRow.domain,
        default_subdomain: null,
      });
    }
  }

  if (!normalized && admin && siteRow.template_id) {
    const draft = await loadDraftTemplate(siteRow.template_id);
    if (draft?.data) {
      normalized = normalizeForRenderer(draft.data, draft.siteFields);
    }
  }

  if (!normalized) return notFound();

  const pageSlug = rest?.[0] ?? firstPageSlug(normalized);
  const colorMode = (normalized.color_mode ?? 'light') as 'light' | 'dark';
  const baseUrl = `${await originFromHeaders()}/sites`;

  return (
    <TemplateEditorProvider
      templateName={normalized.template_name ?? normalized.slug ?? String(normalized.id)}
      colorMode={colorMode}
      initialData={normalized as any}
    >
      <SiteRenderer
        site={normalized as any}
        page={pageSlug}
        baseUrl={baseUrl}
        id="site-renderer-page"
        colorMode={colorMode}
        className="bg-white text-black dark:bg-black dark:text-white"
      />
    </TemplateEditorProvider>
  );
}
