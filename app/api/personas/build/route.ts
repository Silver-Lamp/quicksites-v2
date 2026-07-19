// app/api/personas/build/route.ts
//
// Intake for the HiveJournal Personas × QuickSites About-Me automation test. A Persona (or its
// agent) POSTs its identity JSON; we assemble an About-Me site on the `personal` scaffold and insert
// it as a DRAFT (never auto-published) stamped as an AI persona. A human approves (publishes) before
// it reaches the public /personas showcase. See lib/personas/buildPersonaSite.ts for the guardrails.
//
// Auth: a shared secret (PERSONA_BUILD_SECRET) via X-Persona-Key — fail-closed if the env is unset
// (so the endpoint is inert until the pilot is deliberately turned on). Server-to-server only.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaTemplate, type PersonaInput } from '@/lib/personas/buildPersonaSite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}
function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

async function firstAdminOwner(db: ReturnType<typeof admin>): Promise<string | null> {
  if (process.env.PERSONA_BUILD_OWNER_ID) return process.env.PERSONA_BUILD_OWNER_ID;
  try {
    const { data } = await db.from('admin_users').select('user_id').limit(1);
    return (data?.[0] as any)?.user_id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.PERSONA_BUILD_SECRET;
  if (!secret) return NextResponse.json({ error: 'persona build not configured' }, { status: 503 });
  if (req.headers.get('x-persona-key') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const persona: PersonaInput = body?.persona ?? body;
  if (!persona || typeof persona.name !== 'string' || !persona.name.trim()) {
    return NextResponse.json({ error: 'persona.name is required' }, { status: 400 });
  }
  if (typeof persona.bio !== 'string' || !persona.bio.trim()) {
    return NextResponse.json({ error: 'persona.bio is required' }, { status: 400 });
  }

  let tpl;
  try {
    tpl = buildPersonaTemplate(persona);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'build failed' }, { status: 500 });
  }

  const db = admin();
  const ownerId = await firstAdminOwner(db);

  // Insert as a DRAFT (is_site=false, not published). Retry slug collisions.
  let insertedId: string | null = null;
  let slug = tpl.slug;
  for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
    const row: any = {
      id: uuid(),
      template_name: attempt === 0 ? tpl.template_name : `${tpl.template_name} ${attempt + 1}`,
      slug,
      data: tpl.data,
      color_mode: tpl.color_mode,
      header_block: tpl.header_block,
      footer_block: tpl.footer_block,
      is_site: false,
      published: false,
      industry: tpl.industry,
      business_name: tpl.business_name,
      owner_id: ownerId,
      claim_source: 'persona_build',
    };
    const { data, error } = await db.from('templates').insert(row).select('id, slug').single();
    if (!error && data) {
      insertedId = data.id;
      slug = data.slug;
      break;
    }
    if (error && `${error.code}` === '23505') {
      slug = `${tpl.slug}-${Math.random().toString(36).slice(2, 5)}`;
      continue;
    }
    return NextResponse.json({ error: error?.message || 'insert failed' }, { status: 500 });
  }
  if (!insertedId) return NextResponse.json({ error: 'could not allocate a unique draft' }, { status: 500 });

  return NextResponse.json({
    ok: true,
    id: insertedId,
    slug,
    status: 'draft',
    // Human-approve here: review in the editor, then publish → it appears on /personas.
    editorUrl: `/admin/templates/${slug}`,
    note: 'Draft created (AI persona, noindex). A human must approve + publish before it reaches /personas.',
  });
}
