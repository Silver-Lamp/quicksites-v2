import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime='nodejs'; export const dynamic='force-dynamic';

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });

  const { data: merch } = await supa.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  if (!merch) return NextResponse.json({ error:'No merchant' }, { status:400 });

  // ensure snapshot exists/updated
  try {
    await svc.rpc('compliance_recompute_status', { p_merchant_id: merch.id })
  } catch (e) {
    console.error(e);
  }

  const { data: st } = await svc.from('compliance_status').select('*').eq('merchant_id', merch.id).maybeSingle();

  // map codes -> human labels
  const codes = [...new Set([...(st?.missing||[]), ...((st?.expiring||[]) as any)])];
  const { data: reqs } = await svc
    .from('compliance_requirements')
    .select('id, code, details, operation_type, juris_state')
    .in('code', codes.length?codes:['__none__']);

  // expiring dates
  const { data: expDocs } = await svc
    .from('compliance_docs')
    .select('requirement_id, expires_at')
    .eq('merchant_id', merch.id)
    .in('requirement_id', (reqs||[]).map(r=>r.id));

  return NextResponse.json({
    overall: st?.overall || 'blocked',
    missing: (st?.missing || []) as string[],
    expiring: (st?.expiring || []) as string[],
    labels: (reqs||[]).reduce((m:any, r:any) => (m[r.code] = r.details?.label || r.code, m), {}),
    expireDates: (expDocs||[]).reduce((m:any, d:any) => (m[d.requirement_id] = d.expires_at, m), {})
  });
}
