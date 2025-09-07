// app/api/admin/org/update/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

const ALLOWED_KEYS = new Set([
  'name',
  'slug',
  'logo_url',
  'dark_logo_url',
  'favicon_url',
  'support_email',
  'support_url',
  'billing_mode',
  'theme_json',
]);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orgId = (url.searchParams.get('org_id') || '').trim();
    const wantStats = url.searchParams.get('stats') === '1';
    if (!wantStats || !orgId) return j({ error: 'org_id and stats=1 required' }, 400);

    const [{ count: templates }, { count: domains }, { count: members }] = await Promise.all([
      supabaseAdmin.from('templates').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabaseAdmin.from('org_domains').select('host', { count: 'exact', head: true }).eq('org_id', orgId),
      supabaseAdmin.from('org_members').select('user_id', { count: 'exact', head: true }).eq('org_id', orgId),
    ]);

    return j({
      templates: templates ?? 0,
      domains: domains ?? 0,
      members: members ?? 0,
    });
  } catch (e: any) {
    return j({ error: e?.message || 'stats failed' }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: 'create' | 'update' | 'delete' };

    if (action === 'create') {
      const { values } = body as { values: Record<string, any> };
      if (!values?.name || !values?.slug) return j({ error: 'name and slug are required' }, 400);

      const clean: Record<string, any> = {};
      for (const k of Object.keys(values)) if (ALLOWED_KEYS.has(k)) clean[k] = values[k];

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .insert(clean)
        .select('id, slug')
        .single();
      if (error) return j({ error: error.message }, 500);
      return j({ ok: true, id: data?.id, slug: data?.slug });
    }

    if (action === 'delete') {
      const { id } = body as { id: string };
      if (!id) return j({ error: 'id required' }, 400);

      const { count: tplCount } = await supabaseAdmin
        .from('templates')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', id);
      if ((tplCount ?? 0) > 0) {
        return j(
          { error: 'delete_blocked_templates', message: 'Organization has templates; delete or move them first.' },
          400
        );
      }

      await supabaseAdmin.from('org_members').delete().eq('org_id', id);
      await supabaseAdmin.from('org_domains').delete().eq('org_id', id);

      const { error } = await supabaseAdmin.from('organizations').delete().eq('id', id);
      if (error) return j({ error: error.message }, 500);
      return j({ ok: true });
    }

    // default: update
    const { id, updates } = body as { id: string; updates: Record<string, any> };
    if (!id) return j({ error: 'id required' }, 400);

    const clean: Record<string, any> = {};
    for (const k of Object.keys(updates || {})) if (ALLOWED_KEYS.has(k)) clean[k] = updates[k];
    if (!Object.keys(clean).length) return j({ error: 'no valid fields' }, 400);

    const { error } = await supabaseAdmin.from('organizations').update(clean).eq('id', id);
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true });
  } catch (e: any) {
    return j({ error: e?.message || 'update failed' }, 500);
  }
}
