// app/api/service-jobs/[id]/voice-note/route.ts
// Owner sends an async voice note to the tech on this job (played in-ear via HJ). Owner-gated.
//   POST -> { text } -> { ok, result }

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { requireUser } from '@/lib/auth/requireUser';
import { getJobDetail } from '@/lib/serviceJobs/serviceJobs';
import { sendVoiceNote } from '@/lib/serviceJobs/voiceNote';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const job = await getJobDetail(id);
  if (!job || job.owner_id !== gate.user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let text = '';
  let targetTechRef = '';
  try {
    const body = await req.json();
    text = String(body?.text ?? '').trim();
    targetTechRef = String(body?.target_tech_ref ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: 'missing_text' }, { status: 400 });

  const result = await sendVoiceNote(gate.user.id, id, text, targetTechRef || null);
  return NextResponse.json({ ok: result.ok, result });
}
