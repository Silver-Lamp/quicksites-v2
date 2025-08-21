// app/api/admin/compliance/docs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies as nextCookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Service-role client for privileged operations
const svc = createAdminClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Build a Supabase client bound to this request's cookies (server adapter)
async function getSupabase(): Promise<SupabaseClient<Database>> {
  const store = await nextCookies(); // ✅ sync in route handlers

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supa = await getSupabase();

  // Auth + admin gate
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: admin } = await supa
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Parse inputs
  const body = await req.json();
  const action = String(body.action || '').toLowerCase(); // 'approve' | 'reject'
  const note = body.note?.toString() || null;
  const expires_at = body.expires_at ? new Date(body.expires_at).toISOString().slice(0, 10) : null;
  const issued_at = body.issued_at ? new Date(body.issued_at).toISOString().slice(0, 10) : null;

  // Load doc
  const { data: doc, error: e0 } = await svc
    .from('compliance_docs')
    .select('id, merchant_id, requirement_id, status, fields')
    .eq('id', params.id)
    .maybeSingle();
  if (e0 || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Apply action
  if (action === 'approve') {
    const { error: e1 } = await svc
      .from('compliance_docs')
      .update({
        status: 'approved',
        reviewer: user.email || user.id,
        reviewed_at: new Date().toISOString(),
        expires_at,
        issued_at,
      })
      .eq('id', params.id);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  } else if (action === 'reject') {
    const { error: e2 } = await svc
      .from('compliance_docs')
      .update({
        status: 'rejected',
        reviewer: user.email || user.id,
        reviewed_at: new Date().toISOString(),
        fields: { ...(doc as any).fields, reject_note: note },
      })
      .eq('id', params.id);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  // Fetch detail for notifications
  const { data: detail } = await svc
    .from('compliance_docs')
    .select(
      `id, merchant_id, requirement_id, kind, expires_at, issued_at,
       compliance_requirements(code, operation_type, juris_state),
       merchants(user_id, display_name, name),
       profiles:merchant_compliance_profiles(state, county, operation_type)`
    )
    .eq('id', params.id)
    .maybeSingle();

  // Notify owner via email_outbox
  const ownerId = detail?.merchants?.[0]?.user_id || '';
  const { data: owner } = ownerId ? await svc.auth.admin.getUserById(ownerId) : { data: null as any };
  const toEmail = owner?.user?.email || null;

  const prettyReq = `${detail?.compliance_requirements?.[0]?.juris_state}/${
    detail?.compliance_requirements?.[0]?.operation_type
  }/${detail?.compliance_requirements?.[0]?.code}`;
  const title = detail?.merchants?.[0]?.display_name || detail?.merchants?.[0]?.name || 'Chef';

  if (action === 'approve' && toEmail) {
    await svc.from('email_outbox').insert({
      to_user_id: ownerId || null,
      to_email: toEmail,
      subject: 'Your compliance document was approved ✅',
      html: `<p>Hi ${title},</p>
             <p>Your document for <b>${prettyReq}</b> was approved.</p>
             ${expires_at ? `<p>Expiry: <b>${expires_at}</b></p>` : ''}
             <p>You can now publish meals that require this credential.</p>`,
    });
  }

  if (action === 'reject' && toEmail) {
    await svc.from('email_outbox').insert({
      to_user_id: ownerId || null,
      to_email: toEmail,
      subject: 'Action needed: document rejected ❌',
      html: `<p>Hi ${title},</p>
             <p>Your upload for <b>${prettyReq}</b> was <b>rejected</b>.</p>
             ${note ? `<p>Reason: ${note}</p>` : ''}
             <p>Please re-upload a correct document here: 
             <a href="${process.env.APP_BASE_URL}/chef/compliance?focus=${
               detail?.compliance_requirements?.[0]?.code ?? ''
             }">Open compliance</a></p>`,
    });
  }

  // Optional Slack notification
  if (process.env.COMPLIANCE_SLACK_WEBHOOK_URL) {
    const payload = {
      text: `Compliance ${action}: ${prettyReq} • ${title} (${detail?.profiles?.[0]?.state}/${detail?.profiles?.[0]?.county || '-'})`,
    };
    await fetch(process.env.COMPLIANCE_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  // Recompute status snapshot
  await svc.rpc('compliance_recompute_status', { p_merchant_id: doc.merchant_id });

  return NextResponse.json({ ok: true });
}
