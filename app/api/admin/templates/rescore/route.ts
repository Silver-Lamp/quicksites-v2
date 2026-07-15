// app/api/admin/templates/rescore/route.ts
//
// Recompute + persist a template's SEO-readiness score on demand. Used after an
// in-place "next step" action (which mutates the site outside the commit route, so
// the commit-time refresh doesn't fire) so the list reflects the new state.

import { NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { persistReadinessScore } from '@/lib/seo/persistReadiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const id = String(body?.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const gate = await requireTemplateOwner(id);
  if (!gate.ok) return gate.response;

  const { data: row } = await supabaseAdmin
    .from('templates')
    .select('data, industry, slug')
    .eq('id', id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await persistReadinessScore(id, (row as any).data ?? {}, (row as any).industry, (row as any).slug);
  return NextResponse.json({ ok: true });
}
