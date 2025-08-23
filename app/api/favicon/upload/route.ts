// app/api/favicon/upload/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  template_id: string;
  png_base64: string;           // raw base64 (no data: prefix)
  folder?: string;              // default: template-<id>
  name?: string;                // default: favicon-32
  bucket?: string;              // default: favicons
};

export async function POST(req: Request) {
  try {
    const { template_id, png_base64, folder, name, bucket } = (await req.json()) as Body;
    if (!template_id || !png_base64) {
      return NextResponse.json({ error: 'template_id and png_base64 are required' }, { status: 400 });
    }

    const store = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return store.get(name)?.value; },
          set(name: string, value: string, options: any) { store.set({ name, value, ...options }); },
          remove(name: string, options: any) { store.set({ name, value: '', ...options, maxAge: 0 }); },
        },
        cookieEncoding: 'base64url',
      }
    );

    // must be authenticated for storage RLS
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const bkt = bucket || 'favicons';
    const base = folder || `template-${template_id}`;
    const fname = `${name || 'favicon-32'}-${Date.now()}.png`;
    const path = `${base}/${fname}`;

    // decode base64 -> Buffer
    const bin = Buffer.from(png_base64, 'base64');

    const { error: upErr } = await supabase.storage
      .from(bkt)
      .upload(path, bin, { contentType: 'image/png', cacheControl: '3600', upsert: false });

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    const { data: urlData } = supabase.storage.from(bkt).getPublicUrl(path);
    const url = urlData.publicUrl;

    // merge meta & set favicon_url
    const { data: row } = await supabase
      .from('templates')
      .select('meta')
      .eq('id', template_id)
      .single();

    const meta = { ...(row?.meta || {}), favicon_url: url };
    const { error: updErr } = await supabase
      .from('templates')
      .update({ meta })
      .eq('id', template_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ url });
  } catch (e: any) {
    console.error('[favicon/upload] error', e);
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 });
  }
}
