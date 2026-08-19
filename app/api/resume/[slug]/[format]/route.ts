// app/api/resume/[slug]/[format]/route.ts
//
// The PUBLIC résumé download for a site: `/api/resume/sandon/pdf`.
//
// This is the one and only way a résumé file reaches the world. Everything about its shape is a
// consequence of one decision recorded in migration 20260824 — the *document* may be public, the
// *label* naming who it was tailored for may not:
//
// ⚠️ THE URL IS CONSTANT AND SAYS NOTHING. It names the site and a format, never a version and
// never a company. Switching which résumé is public is a database update; the link on the page,
// in someone's bookmarks, and in an email sent last month all keep working and all start serving
// the new one. The alternative — a public bucket with a file per version — publishes the tailoring
// in the URL and cannot be walked back.
//
// ⚠️ IT STREAMS RATHER THAN REDIRECTING, so the outgoing filename is ours to set. A redirect to
// storage would hand the visitor the object's own name, and the whole point is that what lands in
// a recruiter's Downloads folder is `Sandon-Jurowski-Resume.pdf`.
//
// ⚠️ SERVICE ROLE IS UNAVOIDABLE HERE — the caller is anonymous, so there is no session to scope —
// which is exactly why the query is written to be narrow: owner resolved from the slug, and
// `is_public` required in the same statement. There is no code path through this file that can
// return a version its owner did not explicitly publish.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import {
  RESUME_BUCKET,
  RESUME_FORMATS,
  downloadFilenameFor,
  isResumeFormat,
  type ResumeFile,
} from '@/lib/resumes/versions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; format: string }> }
) {
  const limited = await rateLimitOr429(req, 'resume-download', 60, 3600);
  if (limited) return limited;

  const { slug, format } = await ctx.params;
  if (!isResumeFormat(format)) {
    return NextResponse.json({ error: 'Unknown format.' }, { status: 404 });
  }

  const { data: site } = await supabaseAdmin
    .from('templates')
    .select('id, data')
    .eq('slug', slug)
    .maybeSingle();
  const siteId = (site as { id?: string } | null)?.id;
  if (!siteId) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // ⚠️ MATCHED ON THE SITE, NOT ITS OWNER. Resolving `slug → owner → the owner's public version`
  // is the bug fixed in migration 20260830: this account owns 2,227 templates, so every one of
  // them served the résumé, each under its own business name. Both filters below are load-bearing
  // and neither may become conditional.
  const { data: version } = await supabaseAdmin
    .from('resume_versions')
    .select('label, files')
    .eq('public_site_id', siteId)
    .eq('is_public', true)
    .maybeSingle();
  if (!version) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const file = (((version as { files?: ResumeFile[] }).files ?? []) as ResumeFile[]).find(
    (f) => f.format === format
  );
  if (!file?.path) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const dl = await supabaseAdmin.storage.from(RESUME_BUCKET).download(file.path);
  if (dl.error || !dl.data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const meta = (site as { data?: { meta?: Record<string, unknown> } } | null)?.data?.meta ?? {};
  const person =
    (typeof meta.business_name === 'string' && meta.business_name) ||
    (typeof meta.siteTitle === 'string' && meta.siteTitle) ||
    slug;

  return new NextResponse(await dl.data.arrayBuffer(), {
    headers: {
      'content-type': file.content_type || RESUME_FORMATS[format].contentType,
      // ⚠️ The version label is NOT here and must never be. This filename is forwarded by hand.
      'content-disposition': `attachment; filename="${downloadFilenameFor(person, format)}"`,
      // Switching the public version has to take effect immediately; a cached copy of the previous
      // one is the failure this whole design exists to avoid.
      'cache-control': 'no-store, max-age=0',
    },
  });
}
