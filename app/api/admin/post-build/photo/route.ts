// app/api/admin/post-build/photo/route.ts
//
// POST multipart { file } → a public URL in the `site-images` bucket under post-builds/. For the
// photos an operator crops out of a post. Admin-only; images only; 8 MB cap.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: 'image_only', detail: file.type }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  const path = `post-builds/${globalThis.crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage.from('site-images').upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: 'upload_failed', detail: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, url: supabaseAdmin.storage.from('site-images').getPublicUrl(path).data.publicUrl });
}
