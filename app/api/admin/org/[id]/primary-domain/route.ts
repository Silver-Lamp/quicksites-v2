import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRK = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!;

const DOMAIN_RX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const norm = (s:string) => String(s||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/^www\./,'').replace(/\.$/,'');

export async function POST(req: NextRequest, { params }: { params:{ id:string } }) {
  try {
    const body = await req.json().catch(()=> ({}));
    const apex = body?.primary_domain != null ? norm(body.primary_domain) : null;
    const wildcard_enabled = !!body?.wildcard_enabled;
    const canonical_host = body?.canonical_host === 'apex' ? 'apex' : 'www';

    if (!URL || !SRK) return NextResponse.json({ ok:false, error:'Missing SUPABASE env' }, { status:500 });

    if (apex !== null && apex !== '' && !DOMAIN_RX.test(apex)) {
      return NextResponse.json({ ok:false, error:'Enter a valid apex like example.com' }, { status:400 });
    }

    // AuthZ: the caller must be an admin of THIS org (or a platform admin). The
    // update below uses the service role (RLS bypass), so this is the real gate —
    // the previous version read the org via the user client but never checked
    // membership, letting anyone hijack any org's primary domain.
    const gate = await requireUser();
    if (gate instanceof NextResponse) return gate;

    const admin = createClient(URL, SRK, { auth:{ persistSession:false }});
    const [{ data: isOrgAdmin }, { data: platformAdmin }] = await Promise.all([
      (admin as any).schema('app').rpc('is_org_admin', { p_org: params.id, p_user: gate.user.id }),
      admin.from('admin_users').select('user_id').eq('user_id', gate.user.id).maybeSingle(),
    ]);
    if (!isOrgAdmin && !platformAdmin) {
      return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });
    }
    const { data, error } = await admin
      .from('organizations')
      .update({
        primary_domain: apex || null,
        wildcard_enabled,
        canonical_host,
        primary_domain_verified: false, // will flip on verify
      })
      .eq('id', params.id)
      .select('id, primary_domain, wildcard_enabled, canonical_host')
      .single();

    if (error) return NextResponse.json({ ok:false, error: error.message }, { status:400 });

    return NextResponse.json({ ok:true, ...data });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || 'Unexpected error' }, { status:500 });
  }
}
