// app/api/admin/demos/generate/route.ts
//
// Generate N AI demo sites. Admin (cookie) OR cron (secret) auth.
// Body/query: count (1–10), dryRun (1 = spec only, zero cost), withHeroImage.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminUserId } from '@/lib/auth/adminUser';
import { isCronAuthorized } from '@/lib/cron/auth';
import { generateDemoSite } from '@/lib/builder/generateDemoSite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function firstAdminOwner(): Promise<string | null> {
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await db.from('admin_users').select('user_id').limit(1);
    return data?.[0]?.user_id ?? null;
  } catch {
    return null;
  }
}

async function handle(req: NextRequest) {
  const cron = isCronAuthorized(req);
  let ownerId = cron ? null : await adminUserId();
  if (!ownerId && !cron) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!ownerId) ownerId = await firstAdminOwner();

  const url = new URL(req.url);
  const body = req.method === 'POST' ? await req.json().catch(() => ({} as any)) : {};
  const count = Math.max(1, Math.min(10, Number(body?.count ?? url.searchParams.get('count') ?? 1)));
  const dryRun = body?.dryRun === true || url.searchParams.get('dryRun') === '1';
  const withHeroImage = !(body?.withHeroImage === false || url.searchParams.get('noImage') === '1');

  const results = [];
  for (let i = 0; i < count; i++) {
    const seed = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line no-await-in-loop
    results.push(await generateDemoSite({ ownerId, withHeroImage, dryRun, seed }));
  }

  const created = results.filter((r: any) => r.ok && !r.dryRun).length;
  const failed = results.filter((r: any) => !r.ok);
  return NextResponse.json({ ok: true, count, dryRun, created, failed: failed.length, results });
}

export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest) { return handle(req); }
