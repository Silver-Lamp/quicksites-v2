// app/admin/candidate/[slug]/print/page.tsx
import { headers } from 'next/headers';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { CandidatePrintQRBlock } from '@/components/blocks/candidate/print-qr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function hostPath(u: string) {
  try { const x = new URL(u); return (x.host + x.pathname).replace(/\/$/, ''); } catch { return u ?? ''; }
}

export default async function CandidatePrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getServerSupabase({ serviceRole: true });

  // 1) candidate page blocks (to grab name/office/city/hero urls when available)
  const pg = await supabase
    .from('candidate_pages')
    .select('blocks')
    .eq('slug', slug)
    .maybeSingle();

  let blocksPayload: any = pg.data?.blocks ?? null;
  try {
    if (typeof blocksPayload === 'string') blocksPayload = JSON.parse(blocksPayload);
  } catch {}
  const blocks = Array.isArray(blocksPayload)
    ? blocksPayload
    : Array.isArray(blocksPayload?.blocks)
    ? blocksPayload.blocks
    : [];

  const hero = (blocks.find((b: any) => b?.type === 'candidate_hero')?.content ?? {}) as any;
  const name = hero?.name ?? '';
  const office = hero?.office ?? '';
  const city = hero?.city ?? '';
  const heroShort = hero?.shortUrl as string | undefined;
  const heroUrl = hero?.url as string | undefined;
  const logoUrl = undefined as string | undefined; // attach if you store a logo

  // 2) latest short link for this candidate
  const ln = await supabase
    .from('short_links')
    .select('code, created_at')
    .eq('candidate_slug', slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3) compute base (works locally and in prod)
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const isLocal = /^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$|\.local$/i.test(host);
  const proto = h.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https');
  const configuredBase = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const base = host ? `${proto}://${host}` : configuredBase;

  const shortUrl = ln.data?.code ? `${base}/c/${ln.data.code}` : heroShort ?? heroUrl ?? `${base}/candidate/${slug}`;

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8 mt-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Print &amp; QR — {slug}</h1>
        <div className="flex items-center gap-3">
          <a href={`/candidate/${slug}`} target="_blank" className="text-sm text-indigo-500 hover:underline">
            View public page ↗
          </a>
          <Link href="/admin/short-links" className="text-sm text-gray-400 hover:underline">
            ← Back to Short Links
          </Link>
        </div>
      </div>

      {/* Primary card */}
      <CandidatePrintQRBlock
        content={{
          shortUrl,
          name,
          office,
          city,
          logoUrl,
          note: 'Scan to learn more',
          variant: 'card',
          previewSize: 192,
          exportSize: 1024,
          showDownload: true,
        }}
      />

      {/* Multi-up sheet (2×4) */}
      <div className="mt-8">
        <CandidatePrintQRBlock
          content={{
            shortUrl,
            name,
            office,
            city,
            variant: 'sheet',
            rows: 2,
            cols: 4,
            sheetQrSize: 148,
            cardNote: 'Scan to learn more',
            showDownload: false,
          }}
        />
      </div>

      {/* Poster-style flyer */}
      <div className="mt-8">
        <CandidatePrintQRBlock
          content={{
            shortUrl,
            name,
            office,
            city,
            variant: 'flyer',
            flyerEmphasis: 'Join the campaign',
            flyerBullets: ['Volunteer sign-ups', 'Event reminders', 'Donate in seconds'],
            showDownload: false,
          }}
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Using: <code className="font-mono">{hostPath(shortUrl)}</code>
      </p>
    </div>
  );
}
