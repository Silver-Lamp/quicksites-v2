// app/api/fix-template/route.ts
import { ensureBlockId } from '@/admin/lib/ensureBlockId';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

type FixResult = {
  success: true;
  templateId: string;
  pagesPatched: number;
  blocksPatched: number;
  rev?: number | null;
} | {
  success: false;
  error: string;
  detail?: string;
};

export async function POST(req: Request) {
  try {
    const { fixes } = (await req.json().catch(() => ({}))) as { fixes?: unknown };
    const templateId = new URL(req.url).searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json<FixResult>({ success: false, error: 'Missing templateId' }, { status: 400 });
    }

    // Auth’d user client (for row lookup / RLS)
    const supabase = await getServerSupabase();

    // Load site by ID (we only need data + a sanity on is_site)
    const { data: site, error } = await supabase
      .from('templates')
      .select('id, data, is_site')
      .eq('id', templateId)
      .maybeSingle();

    if (error || !site) {
      return NextResponse.json<FixResult>({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Be defensive: ensure pages array exists
    // site.data is Json — cast to any to access .pages (Pattern E)
    const siteData = site?.data as any;
    const beforePages: any[] = Array.isArray(siteData?.pages) ? siteData.pages : [];
    if (!beforePages.length) {
      return NextResponse.json<FixResult>({
        success: false,
        error: 'No pages to fix (data.pages is empty or missing)',
      }, { status: 400 });
    }

    // Patch: ensure each block has a stable _id
    let blocksPatched = 0;
    const updatedPages = beforePages.map((page: any) => {
      const blocks = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
      const fixedBlocks = blocks.map((b: any) => {
        const beforeId = b?._id;
        const after = ensureBlockId(b);
        if (!beforeId && after?._id) blocksPatched += 1;
        return after;
      });
      return { ...page, content_blocks: fixedBlocks };
    });

    // Get current rev for commit
    const { data: revRow, error: revErr } = await supabaseAdmin
      .from('templates')
      .select('rev')
      .eq('id', templateId)
      .single();

    const currentRev = (revRow?.rev ?? 0) as number;

    // Build commit payload (small patch that replaces only pages under data)
    const payload = {
      id: templateId,
      base_rev: currentRev,
      patch: { data: { pages: updatedPages } },
      actor: null,
      kind: 'fix-block-ids',
    };

    // Call the universal commit wrapper (security definer) — recommended
    // If you didn’t create app.commit_template_json(jsonb), fall back to public/app entrypoints.
    let rpcErr: any = null;
    let revAfter: number | null = null;

    try {
      // Preferred wrapper if present:
      const r = await supabaseAdmin
        .schema('app')
        .rpc('commit_template_json', { p_payload: payload as any });

      if (r.error) rpcErr = r.error;
    } catch (e: any) {
      rpcErr = e;
    }

    if (rpcErr) {
      // Fallback to public.commit_template_http(jsonb)
      const r2 = await supabaseAdmin
        .schema('public')
        .rpc('commit_template_http', { p_payload: payload as any });

      if (r2.error) {
        // Final fallback to app.commit_template(args...) flavor
        const r3 = await supabaseAdmin
          .schema('app')
          .rpc('commit_template', {
            p_id: templateId,
            p_base_rev: currentRev,
            p_patch: payload.patch,
            p_actor: null,
            p_kind: 'fix-block-ids',
          } as any);

        if (r3.error) {
          const code = String(r3.error.code || rpcErr?.code || '').toUpperCase();
          const msg = r3.error.message || rpcErr?.message || 'Commit failed';
          return NextResponse.json<FixResult>(
            { success: false, error: 'Guard blocked update', detail: `${code} ${msg}` },
            { status: 409 }
          );
        }
      }
    }

    // Read back new rev (best-effort)
    const { data: afterRow } = await supabaseAdmin
      .from('templates')
      .select('rev')
      .eq('id', templateId)
      .single();
    revAfter = (afterRow?.rev ?? null) as number | null;

    return NextResponse.json<FixResult>({
      success: true,
      templateId,
      pagesPatched: updatedPages.length,
      blocksPatched,
      rev: revAfter,
    });
  } catch (e: any) {
    return NextResponse.json<FixResult>(
      { success: false, error: e?.message || 'Server error' },
      { status: 500 }
    );
  }
}
