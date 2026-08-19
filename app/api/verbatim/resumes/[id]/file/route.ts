// app/api/verbatim/resumes/[id]/file/route.ts
//
// The OWNER's download of one of their own versions — public or not — so the workspace can offer
// "open this" without the file ever being world-readable.
//
// ⚠️ The neutral filename rule applies here too, and it is not belt-and-braces. This is the copy
// the owner attaches to an email. If their own download were named after the version, the leak
// would happen on the way OUT of their machine, which no amount of care on our side would catch.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireUser';
import {
  RESUME_BUCKET,
  RESUME_FORMATS,
  downloadFilenameFor,
  isResumeFormat,
  type ResumeFile,
} from '@/lib/resumes/versions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const { id } = await ctx.params;
  const format = req.nextUrl.searchParams.get('format') ?? 'pdf';
  if (!isResumeFormat(format)) {
    return NextResponse.json({ error: 'Unknown format.' }, { status: 404 });
  }

  // Caller's client: RLS is what proves this row is theirs.
  const db = await getServerSupabase();
  // `as any` — see the note in ../../route.ts: this table is deliberately absent from the
  // generated types rather than reached with the service role.
  const { data: version } = await (db as any)
    .from('resume_versions')
    .select('files')
    .eq('id', id)
    .maybeSingle();
  if (!version) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const file = (((version as { files?: ResumeFile[] }).files ?? []) as ResumeFile[]).find(
    (f) => f.format === format
  );
  if (!file?.path) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const dl = await supabaseAdmin.storage.from(RESUME_BUCKET).download(file.path);
  if (dl.error || !dl.data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const name = gate.user.user_metadata?.full_name || gate.user.email?.split('@')[0] || 'Resume';
  return new NextResponse(await dl.data.arrayBuffer(), {
    headers: {
      'content-type': file.content_type || RESUME_FORMATS[format].contentType,
      'content-disposition': `attachment; filename="${downloadFilenameFor(String(name), format)}"`,
      'cache-control': 'no-store, max-age=0',
    },
  });
}
