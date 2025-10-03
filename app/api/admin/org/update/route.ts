import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Admin update endpoint for organizations
 * - Requires platform admin (admin_users) OR service-key path (for action=create/delete).
 * - Accepts scalar updates and JSONB `branding`.
 * - Optional merge behavior for branding (see MERGE_BRANDING flag).
 */

// If you want deep-merge instead of full replace when branding is provided:
const MERGE_BRANDING = true;

type UpdateBody =
  | { action: 'create'; values: { name: string; slug: string } }
  | { action: 'delete'; id: string }
  | {
      id: string;
      updates: {
        name?: string | null;
        slug?: string | null;
        logo_url?: string | null;
        dark_logo_url?: string | null;
        favicon_url?: string | null;
        support_email?: string | null;
        support_url?: string | null;
        billing_mode?: 'central' | 'reseller' | 'none' | null;
        // JSONB
        branding?: any | null;
      };
    };

export async function GET(req: NextRequest) {
  // You use GET for ?stats=1; keep your existing implementation
  // (left as-is, since your frontend relies on it).
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Auth (platform admin) using your existing pattern:
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { async get(n: string) { return cookieStore.get(n)?.value; } } as any }
  );

  const { data: me } = await supabase.auth.getUser();
  const userId = me?.user?.id ?? null;

  const { data: isAdminRow } =
    userId
      ? await supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
      : { data: null as null };

  const isPlatformAdmin = !!isAdminRow;

  // Service role client for privileged writes
  const supaAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // keep on server only
  );

  // Handle actions
  if ('action' in body) {
    if (body.action === 'create') {
      if (!isPlatformAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { values } = body;
      if (!values?.name || !values?.slug) {
        return NextResponse.json({ error: 'Missing name/slug' }, { status: 400 });
      }
      const { data, error } = await supaAdmin
        .from('organizations')
        .insert({
          name: values.name,
          slug: values.slug.toLowerCase(),
          branding: null,
        })
        .select('*')
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, data });
    }

    if (body.action === 'delete') {
      if (!isPlatformAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { id } = body;
      const { error } = await supaAdmin.from('organizations').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  // Update flow
  const { id, updates } = body as Extract<UpdateBody, { id: string; updates: any }>;
  if (!id || !updates) {
    return NextResponse.json({ error: 'Missing id/updates' }, { status: 400 });
  }

  if (!isPlatformAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Build the update payload for scalar fields
  const scalarUpdates: Record<string, any> = {};
  const scalars = [
    'name',
    'slug',
    'logo_url',
    'dark_logo_url',
    'favicon_url',
    'support_email',
    'support_url',
    'billing_mode',
  ] as const;

  for (const k of scalars) {
    if (k in updates) {
      scalarUpdates[k] = updates[k as keyof typeof updates];
    }
  }

  // Apply scalar updates first
  if (Object.keys(scalarUpdates).length > 0) {
    const { error: sErr } = await supaAdmin.from('organizations').update(scalarUpdates).eq('id', id);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
  }

  // Handle branding JSONB
  if ('branding' in updates) {
    if (MERGE_BRANDING && updates.branding && typeof updates.branding === 'object') {
      // Deep-merge branding on the DB side to avoid clobbering concurrent keys
      // SQL: branding = branding || <payload>, with null stripping
      const { error: mErr } = await supaAdmin.rpc('merge_org_branding', {
        p_org_id: id,
        p_branding: updates.branding,
      });
      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });
    } else {
      // Replace branding as-is (full overwrite; can be null)
      const { error: bErr } = await supaAdmin
        .from('organizations')
        .update({ branding: updates.branding })
        .eq('id', id);
      if (bErr) return NextResponse.json({ error: bErr.message }, { status: 400 });
    }
  }

  // Return the updated row for convenience
  const { data: updated, error: rErr } = await supaAdmin
    .from('organizations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: updated });
}
