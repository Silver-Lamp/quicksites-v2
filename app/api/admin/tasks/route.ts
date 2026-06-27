// app/api/admin/tasks/route.ts — list + create admin tasks. Admin-gated.
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

// GET /api/admin/tasks?status=open — list tasks (optionally filtered by status).
export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const status = req.nextUrl.searchParams.get('status');
  let q = db().from('admin_tasks').select('*').order('created_at', { ascending: false }).limit(500);
  if (status && isStatus(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

// POST /api/admin/tasks — create a task. Body: { title, details?, priority?, category?, source? }
export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const row: Record<string, any> = {
    title,
    details: body?.details ? String(body.details) : null,
    priority: isPriority(body?.priority) ? body.priority : 'medium',
    category: body?.category ? String(body.category) : null,
    source: body?.source ? String(body.source) : 'manual',
    created_by: admin.id,
  };

  const { data, error } = await db().from('admin_tasks').insert(row).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}
