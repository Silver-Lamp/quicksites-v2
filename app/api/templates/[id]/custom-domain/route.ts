// app/api/templates/[id]/custom-domain/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only

function normalizeApex(d: string) {
  return String(d || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; // Next 15: params is a Promise
    const { custom_domain } = (await req.json()) as { custom_domain?: string };

    const apex = normalizeApex(custom_domain || '');
    if (!apex) return Response.json({ ok: false, error: 'custom_domain required' }, { status: 400 });
    if (!URL || !SRK) return Response.json({ ok: false, error: 'Missing SUPABASE env' }, { status: 500 });

    // RLS read-check & get current rev + actor
    const supaAuthed = await getServerSupabase();
    const [{ data: userRes }, { data: tmpl, error: readErr }] = await Promise.all([
      supaAuthed.auth.getUser(),
      supaAuthed.from('templates').select('rev').eq('id', id).single(),
    ]);
    if (readErr || !tmpl) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const base_rev = Number.isFinite(tmpl.rev) ? (tmpl.rev as number) : 0;
    const actor = userRes?.user?.id ?? '00000000-0000-0000-0000-000000000000';

    // RPC → public.commit_template_patch (which calls app.commit_template(..., p_kind := 'domain'))
    const admin = createClient(URL, SRK, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc('commit_template_patch', {
        p_id: id,
        p_base_rev: base_rev,
        p_patch: { custom_domain: apex },
        p_actor: actor,
        p_kind: 'domain',
      });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });

    const committed = Array.isArray(data) ? data[0] : data;
    return Response.json({
      ok: true,
      custom_domain: apex,
      id: committed?.id ?? id,
      rev: committed?.rev ?? (Number.isFinite(base_rev) ? base_rev + 1 : null),
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
