import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json();
  const { id, ...patch } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // ensure ownership
  const { data: merchant } = await supa.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  if (!merchant) return NextResponse.json({ error: 'No merchant' }, { status: 400 });

  const { error } = await supa
    .from('social_webhooks')
    .update({
      ...(typeof patch.enabled === 'boolean' ? { enabled: patch.enabled } : {}),
      ...(typeof patch.template_text_drop === 'string' ? { template_text_drop: patch.template_text_drop } : {}),
      ...(typeof patch.template_text_last_call === 'string' ? { template_text_last_call: patch.template_text_last_call } : {}),
      ...(typeof patch.template_text_custom === 'string' ? { template_text_custom: patch.template_text_custom } : {}),
      ...(typeof patch.template_include_image === 'boolean' ? { template_include_image: patch.template_include_image } : {}),
      ...(typeof patch.template_include_link === 'boolean' ? { template_include_link: patch.template_include_link } : {}),
      ...(typeof patch.default_hashtags === 'string' ? { default_hashtags: patch.default_hashtags } : {}),
    })
    .eq('id', id)
    .eq('merchant_id', merchant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
