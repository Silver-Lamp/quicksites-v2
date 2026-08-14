// app/api/lemonade/sign/route.ts
//
// Printable table sign + cup cards for a lemonade stand (lib/lemonade/standSign.ts).
// Returns HTML rather than a PDF so the browser's own print dialog handles it — one less
// dependency, and it works from a phone.
//
// Owner-gated even though every fact on the sign is public (the site's URL and its title).
// The reason is that this route reads a template by id, and "the content happens to be
// public" is the argument that turned several other routes here into unauthenticated
// lookups over the whole templates table. The gate costs nothing; the exception costs a
// sweep later.
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { renderStandSignHtml, standUrlFor } from '@/lib/lemonade/standSign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const templateId = req.nextUrl.searchParams.get('templateId') || '';
  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
  }

  const gate = await requireTemplateOwner(templateId);
  if (!gate.ok) return gate.response;

  const { data: row, error } = await supabaseAdmin
    .from('templates')
    .select('id, slug, template_name, business_name, custom_domain, domain, data, published')
    .eq('id', templateId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  // ⚠️ An unpublished stand has no working URL, so a sign printed from it would send every
  // customer to a 404 — on paper, taped to a table, with no way to tell. Fail here instead.
  if (!row.published) {
    return NextResponse.json(
      { error: 'Publish the stand first — the sign would point at a page that is not live yet.' },
      { status: 409 },
    );
  }

  const data = (row.data ?? {}) as any;
  const standName =
    data?.business_name || (row as any).business_name || row.template_name || 'Our Lemonade Stand';

  // The "saving up for" line, if the grown-up filled the story block in. Never invented: an
  // unfilled stand prints a sign with no cause line rather than a plausible one, because the
  // cause is the part customers give extra money for and we are not making that up for them.
  const cause: string | null =
    typeof data?.meta?.lemonade_cause === 'string' && data.meta.lemonade_cause.trim()
      ? data.meta.lemonade_cause.trim()
      : null;

  const standUrl = standUrlFor(row as any);
  if (!standUrl) {
    return NextResponse.json({ error: 'This stand has no address yet.' }, { status: 409 });
  }

  const html = await renderStandSignHtml({ standUrl, standName, cause });

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
