// app/api/companies/hours/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('company_id');
  if (!companyId) return j({ error: 'company_id required' }, 400);

  const pub = supabaseAdmin.schema('public');
  const { data, error } = await pub
    .from('companies')
    .select('business_hours')
    .eq('id', companyId)
    .single();

  if (error) return j({ error: error.message }, 400);
  return j({ hours: data?.business_hours ?? null });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { company_id, hours } = body || {};
  if (!company_id || !hours) {
    return j({ error: 'company_id and hours required' }, 400);
  }

  const pub = supabaseAdmin.schema('public');
  const { data, error } = await pub
    .from('companies')
    .update({ business_hours: hours })
    .eq('id', company_id)
    .select('id')
    .single();

  if (error) return j({ error: error.message }, 400);
  return j({ ok: true, id: data.id });
}
