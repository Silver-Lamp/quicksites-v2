// app/api/deploy-webhook/route.ts
// Use deployWebhook() when you need to deploy a domain
// Use getUserFromRequest() when you need the user context

export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { domain }: { domain: string } = await req.json();
    const webhook = process.env.VERCEL_DEPLOY_WEBHOOK;

    if (!domain || !webhook) {
      return Response.json({ error: 'Missing domain or webhook config' }, { status: 400 });
    }

    const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    const user_id = user?.id ?? null;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;

    if (!user_id) {
      await supabase.from('deploy_logs').insert({
        domain,
        user_id: null,
        ip,
        status: 401,
        error: 'Missing or invalid auth token',
      });
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch domain record
    const { data: domainRow, error: domainErr } = await supabase
      .from('domains')
      .select('*')
      .eq('domain', domain)
      .maybeSingle();

    if (domainErr || !domainRow) {
      await supabase.from('deploy_logs').insert({
        domain,
        user_id,
        ip,
        status: 404,
        error: 'Domain not found',
      });
      return Response.json({ error: 'Domain not found' }, { status: 404 });
    }

    if (!domainRow.is_claimed) {
      await supabase.from('deploy_logs').insert({
        domain,
        user_id,
        ip,
        status: 403,
        error: 'Domain is not claimed',
      });
      return Response.json({ error: 'Domain is not claimed' }, { status: 403 });
    }

    // Check authorization: admin or domain owner
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user_id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';
    const isOwner = domainRow.claimed_user_id === user_id;

    if (!isOwner && !isAdmin) {
      await supabase.from('deploy_logs').insert({
        domain,
        user_id,
        ip,
        status: 403,
        error: 'Unauthorized user for this domain',
      });
      return Response.json({ error: 'Unauthorized for this domain' }, { status: 403 });
    }

    // ✅ Trigger deploy
    const vercelRes = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });

    const result = await vercelRes.json().catch(() => ({}));

    await supabase.from('deploy_logs').insert({
      domain,
      user_id,
      ip,
      status: vercelRes.status,
      result,
    });

    return Response.json({
      ok: true,
      status: vercelRes.status,
      result,
      domainMeta: {
        domain: domainRow.domain,
        is_claimed: domainRow.is_claimed,
        claimed_user_id: domainRow.claimed_user_id,
        site_id: domainRow.site_id,
      },
    });
  } catch (err: any) {
    console.error('[❌ Deploy webhook error]', err);

    await supabase.from('deploy_logs').insert({
      domain: 'unknown',
      user_id: null,
      ip: null,
      status: 500,
      error: err.message ?? 'Internal server error',
    });

    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
