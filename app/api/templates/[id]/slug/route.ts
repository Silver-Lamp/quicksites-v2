// app/api/templates/[id]/slug/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';

const normalize = (s: string) =>
  String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

type Params = { id: string };

export async function PATCH(req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const wanted = normalize((body?.slug ?? '').toString());

    if (!id) return j({ error: 'id required' }, 400);
    if (!wanted) return j({ error: 'slug required' }, 400);

    const gate = await requireTemplateOwner(id);
    if (!gate.ok) return gate.response;

    console.log('[SLUG:PATCH:CALL]', { id, wanted });
    const r = await supabaseAdmin.schema('app').rpc('set_template_slug', {
      p_id: id,
      p_slug: wanted,
      p_rev: body?.rev ?? null,
    });

    if (r.error) {
        const code = String(r.error.code || '').toUpperCase();
        const raw  = r.error.message || '';
        let msg = raw;
        let status = 500;
        
        if (code === '23505') {
            // uniqueness
            if (/slug taken/i.test(raw)) msg = 'That slug is already in use.';
            else if (/domain conflict/i.test(raw)) msg = 'Platform domain is in use by another site.';
            status = 409;
        } else if (code === 'P0001') {
            // guard / published or other custom raises
            if (/published/i.test(raw)) {
            msg = 'Unpublish the base template to change the slug.';
            status = 409;
            } else {
            msg = raw || 'Update blocked by a database guard.';
            status = 409;
            }
        } else if (code === '409') {
            status = 409;
        }
        
        console.warn('[SLUG:PATCH:ERR]', { id, wanted, code, raw });
        return j({ error: msg, code, raw }, status);
    }
      
    const row = Array.isArray(r.data) ? r.data[0] : r.data;
    const targetId = row?.target_id ?? row?.targetId ?? id;
    const slug = row?.slug ?? wanted;
    const rev  = row?.rev ?? null;
    console.log('[SLUG:PATCH:OK]', { id, targetId, slug, rev });

    return j({ ok: true, slug, targetId, rev }, 200);
} catch (e: any) {
    return j({ error: e?.message || 'server error' }, 500);
  }
}
