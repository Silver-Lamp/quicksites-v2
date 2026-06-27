// app/api/admin/tasks/[id]/route.ts — update + delete a single task. Admin-gated.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { isPriority, isStatus } from '@/lib/tasks/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function db(): any {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

// PATCH /api/admin/tasks/:id — update status / priority / title / details / category.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof body?.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if ('details' in body) patch.details = body.details ? String(body.details) : null;
  if ('category' in body) patch.category = body.category ? String(body.category) : null;
  if (isPriority(body?.priority)) patch.priority = body.priority;
  if (isStatus(body?.status)) {
    patch.status = body.status;
    // Stamp/clear completion when crossing the done boundary.
    patch.completed_at = body.status === 'done' ? new Date().toISOString() : null;
  }

  const { data, error } = await db().from('admin_tasks').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

// DELETE /api/admin/tasks/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const { error } = await db().from('admin_tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
