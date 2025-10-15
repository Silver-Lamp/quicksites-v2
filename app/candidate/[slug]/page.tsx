// app/candidate/[slug]/page.tsx
import DemoBlockRenderer from '@/components/render/DemoBlockRenderer';
import { getServerSupabase } from '@/lib/supabase/server';
import { DEFAULT_FREE, type Entitlements } from '@/lib/electinfo/features';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Row = {
  blocks: any;
  site_id?: string | null;
  is_paid?: boolean | null;
  allow_text?: boolean | null;
  allow_email?: boolean | null;
  enable_donations?: boolean | null;
  enable_events?: boolean | null;
  enable_newsletter?: boolean | null;
  enable_endorsements?: boolean | null;
  enable_volunteer?: boolean | null;
};

async function fetchCandidateRow(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  slug: string
): Promise<Row | null> {
  // Try rich shape first; gracefully degrade if columns don't exist.
  const SELECTS = [
    // full (newest)
    `blocks,site_id,is_paid,allow_text,allow_email,enable_donations,enable_events,enable_newsletter,enable_endorsements,enable_volunteer`,
    // no site_id
    `blocks,is_paid,allow_text,allow_email,enable_donations,enable_events,enable_newsletter,enable_endorsements,enable_volunteer`,
    // no is_paid (older rows)
    `blocks,allow_text,allow_email,enable_donations,enable_events,enable_newsletter,enable_endorsements,enable_volunteer`,
    // only allow_* (very old)
    `blocks,allow_text,allow_email`,
    // bare minimum
    `blocks`,
  ];

  for (const sel of SELECTS) {
    const r = await supabase.from('candidate_pages').select(sel).eq('slug', slug).maybeSingle();
    if (!r.error && r.data) return r.data as unknown as Row;
  }
  return null;
}

export default async function CandidatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getServerSupabase({ serviceRole: true });

  const row = await fetchCandidateRow(supabase, slug);
  if (!row) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[candidate_pages] fetch error or no data for slug:', slug);
    }
    return <div className="p-6">Not found</div>;
  }

  // Parse blocks (supports JSON string or JSONB)
  let blocksPayload: any = row.blocks ?? null;
  try {
    if (typeof blocksPayload === 'string') blocksPayload = JSON.parse(blocksPayload);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('JSON.parse(blocks) failed:', e);
  }
  const blocks =
    Array.isArray(blocksPayload)
      ? blocksPayload
      : Array.isArray(blocksPayload?.blocks)
      ? blocksPayload.blocks
      : [];

  const isPaid = !!row.is_paid;

  // Entitlements:
  // - If PAID → force everything on
  // - Else → respect per-feature flags (default off via DEFAULT_FREE)
  const entitlements: Entitlements = isPaid
    ? {
        ...DEFAULT_FREE,
        donations: true,
        events: true,
        newsletter: true,
        endorsements: true,
        volunteer: true,
      }
    : {
        ...DEFAULT_FREE,
        donations: !!row.enable_donations,
        events: !!row.enable_events,
        newsletter: !!row.enable_newsletter,
        endorsements: !!row.enable_endorsements,
        volunteer: !!row.enable_volunteer,
      };

  // Contact preferences:
  // - If PAID and not set yet, default to true
  const ctaPrefs = {
    allowText: row.allow_text == null ? isPaid : !!row.allow_text,
    allowEmail: row.allow_email == null ? isPaid : !!row.allow_email,
  };

  return (
    <DemoBlockRenderer
      blocks={blocks as any}
      entitlements={entitlements}
      siteId={row.site_id ?? undefined} // safe: may be undefined in older schemas
      slug={slug}
      ctaPrefs={ctaPrefs}
    />
  );
}
