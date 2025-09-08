// app/api/favicon/upload/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  template_id: string;
  png_base64: string; // raw base64 (no data: prefix)
  folder?: string;    // default: template-<id>
  name?: string;      // default: favicon-32
  bucket?: string;    // default: favicons
};

export async function POST(req: Request) {
  try {
    const { template_id, png_base64, folder, name, bucket } = (await req.json()) as Body;
    if (!template_id || !png_base64) {
      return NextResponse.json({ error: 'template_id and png_base64 are required' }, { status: 400 });
    }

    // --- User client: auth + storage upload (RLS applies) ---
    const store = await cookies();
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => store.getAll(),
          setAll: (arr) => arr.forEach(({ name, value, options }) => store.set(name, value, options)),
        },
        cookieEncoding: 'base64url',
      }
    );

    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Optional authz check (must be able to SELECT this template under RLS)
    const { data: canRead, error: readErr } = await userClient
      .from('templates')
      .select('id')
      .eq('id', template_id)
      .maybeSingle();
    if (readErr || !canRead) {
      return NextResponse.json({ error: 'Not allowed to modify this template' }, { status: 403 });
    }

    // Upload PNG to Storage
    const bkt = bucket || 'favicons';
    const base = folder || `template-${template_id}`;
    const fname = `${name || 'favicon-32'}-${Date.now()}.png`;
    const path = `${base}/${fname}`;

    const bin = Buffer.from(png_base64, 'base64');
    const { error: upErr } = await userClient.storage
      .from(bkt)
      .upload(path, bin, { contentType: 'image/png', cacheControl: '3600', upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    const { data: urlData } = userClient.storage.from(bkt).getPublicUrl(path);
    const url = urlData.publicUrl;

    // --- Commit via PUBLIC wrapper (PostgREST exposes only public/graphql_public) ---
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: 'Server misconfig: SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 });
    }
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    // Build ops to merge favicon_url into /data/meta
    const ops = [{ op: 'merge', path: '/data/meta', value: { favicon_url: url } }];

    // Determine family latest (same base_slug) so publish uses it too
    const targetIds = new Set<string>([template_id]);

    const { data: srcTpl, error: srcErr } = await admin
      .from('templates')
      .select('id, base_slug')
      .eq('id', template_id)
      .single();

    if (!srcErr && srcTpl?.base_slug) {
      const { data: latest, error: latestErr } = await admin
        .from('templates')
        .select('id')
        .eq('base_slug', srcTpl.base_slug)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latestErr && latest?.id) targetIds.add(latest.id);
    }

    // Commit to each target id via the PUBLIC wrapper
    const actor = auth.user.id as string;
    for (const id of targetIds) {
      const { error: rpcErr } = await admin.rpc('commit_template', {
        p_template_id: id,
        p_ops: ops,
        p_message: 'Set favicon_url',
        p_kind: 'api/favicon',
        p_base_rev: null, // provide a number if you enforce optimistic concurrency
        p_actor: actor,
      });
      if (rpcErr) {
        const hint =
          /function public\.commit_template/.test(rpcErr.message)
            ? ' (did you create the public wrapper?)'
            : '';
        return NextResponse.json(
          { error: `Commit via public.commit_template failed for ${id}: ${rpcErr.message}${hint}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ url, committed_to: Array.from(targetIds) });
  } catch (e: any) {
    console.error('[favicon/upload] error', e);
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 });
  }
}
