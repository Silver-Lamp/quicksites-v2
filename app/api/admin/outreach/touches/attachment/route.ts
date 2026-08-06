// Upload one attachment for an outreach touch (the flyer that was sent, a screenshot of a thread).
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is too large (15 MB max).' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Storage is not configured.' }, { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false } });
  await db.storage.createBucket('outreach', { public: true }).catch(() => {});

  const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safe}`;
  const { error } = await db.storage.from('outreach').upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || 'application/octet-stream', upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ url: db.storage.from('outreach').getPublicUrl(path).data.publicUrl });
}
