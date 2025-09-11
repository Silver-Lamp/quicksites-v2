// app/api/templates/[id]/custom-domain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only

// Strict-ish domain check: labels a-z0-9- (no leading/trailing -), dot-separated, TLD >= 2
const DOMAIN_RX =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function normalizeApex(input: string) {
  const apex = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '') // strip protocol
    .replace(/\/.*$/, '')        // strip any path/query
    .replace(/^www\./, '')       // strip www
    .replace(/\.$/, '');         // strip trailing dot
  return apex;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params; // Next 15: params is a Promise

    // Parse body; allow clearing domain by sending null or empty string.
    const body = (await req.json().catch(() => ({}))) as {
      custom_domain?: string | null;
    };

    if (!URL || !SRK) {
      return NextResponse.json(
        { ok: false, error: 'Missing SUPABASE env' },
        { status: 500 }
      );
    }

    // 1) RLS read-check to authorize actor against the template
    const supaAuthed = await getServerSupabase();
    const [{ data: userRes }, { data: tmpl, error: readErr }] = await Promise.all([
      supaAuthed.auth.getUser(),
      supaAuthed.from('templates').select('rev').eq('id', id).single(),
    ]);
    if (readErr || !tmpl) {
      // Do not leak existence; RLS determines access
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // 2) Normalize/validate the requested domain (or clear it)
    let apex: string | null = null;
    if (body.hasOwnProperty('custom_domain') && body.custom_domain != null) {
      const normalized = normalizeApex(String(body.custom_domain));
      if (normalized.length === 0) {
        apex = null; // treat empty as clear
      } else if (!DOMAIN_RX.test(normalized)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Enter a valid apex domain like example.com (no https://, no paths).',
          },
          { status: 400 }
        );
      } else {
        apex = normalized;
      }
    } else if (body.hasOwnProperty('custom_domain')) {
      // explicit null -> clear
      apex = null;
    } else {
      return NextResponse.json(
        { ok: false, error: 'custom_domain required' },
        { status: 400 }
      );
    }

    const base_rev = Number.isFinite(tmpl.rev as number) ? (tmpl.rev as number) : 0;
    const actor = userRes?.user?.id ?? '00000000-0000-0000-0000-000000000000';

    // 3) Commit via service-role RPC (keeps audit trail + version bump)
    const admin = createClient(URL, SRK, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc('commit_template_patch', {
      p_id: id,
      p_base_rev: base_rev,
      p_patch: { custom_domain: apex }, // can be string or null to clear
      p_actor: actor,
      p_kind: 'domain',
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const committed = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      ok: true,
      id: committed?.id ?? id,
      rev: committed?.rev ?? (Number.isFinite(base_rev) ? base_rev + 1 : null),
      custom_domain: apex,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
