import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DOMAIN_RX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const norm = (s:string) => String(s||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/^www\./,'').replace(/\.$/,'');

export async function POST(req: NextRequest, { params }: { params:{ id:string } }) {
  try {
    const body = await req.json().catch(()=> ({}));
    const apex = body?.primary_domain != null ? norm(body.primary_domain) : null;
    const wildcard_enabled = !!body?.wildcard_enabled;
    const canonical_host = body?.canonical_host === 'apex' ? 'apex' : 'www';

    if (!URL || !SRK) return NextResponse.json({ ok:false, error:'Missing SUPABASE env' }, { status:500 });

    // RLS auth: ensure caller belongs to this org (or is platform admin)
    const supa = await getServerSupabase();
    const [{ data: me }, { data: org, error: orgErr }] = await Promise.all([
      supa.auth.getUser(),
      supa.from('organizations').select('id').eq('id', params.id).single()
    ]);
    if (orgErr || !org) return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });

    if (apex !== null && apex !== '' && !DOMAIN_RX.test(apex)) {
      return NextResponse.json({ ok:false, error:'Enter a valid apex like example.com' }, { status:400 });
    }

    const admin = createClient(URL, SRK, { auth:{ persistSession:false }});
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
