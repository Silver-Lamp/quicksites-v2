import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // service role (NOT exposed to client)
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

export async function POST(req: Request) {
  const initial = await req.json();

  // minimal, canonical payload (don’t send generated cols)
  const payload: any = {
    template_name: initial.template_name ?? initial.slug ?? 'Untitled',
    slug: initial.slug,
    data: initial.data ?? {},
    color_mode: initial.color_mode ?? initial.data?.color_mode ?? 'light',
    header_block: initial.data?.headerBlock ?? null,
    footer_block: initial.data?.footerBlock ?? null,
    ...(typeof initial.is_site === 'boolean' ? { is_site: initial.is_site } : {}),
  };

  const { data, error } = await admin
    .from('templates')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // refresh the materialized view; don’t crash the request if this fails
  try {
    await admin.rpc('refresh_template_bases');
  } catch (e) {
    console.error('refresh_template_bases failed:', e);
  }

  return NextResponse.json({ id: data.id });
}
