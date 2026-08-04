// app/api/agreements/accept/route.ts
//
// Record that a visitor accepted the terms shown in an `agreement` block.
//
// ⚠️ ACCEPTANCE, NOT SIGNATURE. This endpoint is reachable by anyone on a public page, so the
// name is self-reported and there is no identity evidence at all. It is the right record for a
// waiver or a policy acknowledgement, and the wrong one for a contract — for that, the private
// signing link (docs/AGREEMENTS.md) is the product. Nothing here may be presented as a signature.
//
// ⚠️ THE POSTED TEXT IS WHAT GETS HASHED AND STORED, DELIBERATELY. Re-reading the terms from the
// template server-side would hash whatever is stored NOW, which is not necessarily what this
// visitor read — the owner can edit the block at any moment through the ordinary editor, and a
// record of "they accepted the current text" is worthless if the text moved under them. So the
// snapshot comes from the page that was actually rendered, and it is stored in full on the row
// because the template can never be frozen the way `agreements` is.
//
// The trade-off is honest and worth naming: a caller could post terms that were never displayed.
// That is a limitation of any public form, it does not let them forge anyone else's acceptance,
// and the alternative (hashing text the visitor may never have seen) is worse.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { documentHash } from '@/lib/agreements/document';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { clientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_CHARS = 60_000;

export async function POST(req: Request) {
  const limited = await rateLimitOr429(req, 'agreement_accept', 30, 3600);
  if (limited) return limited;

  const raw = await req.json().catch(() => ({} as any));

  const body = String(raw?.body ?? '').slice(0, MAX_BODY_CHARS);
  const title = String(raw?.title ?? '').slice(0, 300);
  const typedName = String(raw?.typedName ?? '').trim().slice(0, 200);

  if (!body.trim() || !title.trim()) {
    return NextResponse.json({ error: 'Nothing to accept.' }, { status: 400 });
  }
  // Both statutory elements checked server-side, exactly as on the signing route — a UI-only
  // check means they are absent for anyone who posts directly.
  if (!typedName) {
    return NextResponse.json({ error: 'Type your full name to accept.' }, { status: 400 });
  }
  if (raw?.consent !== true) {
    return NextResponse.json(
      { error: 'Please confirm you accept these terms.' },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Something went wrong. Nothing was recorded.' }, { status: 500 });
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const email = typeof raw?.email === 'string' ? raw.email.trim().slice(0, 200) || null : null;

  const { error } = await db.from('agreement_acceptances').insert({
    template_id: typeof raw?.templateId === 'string' ? raw.templateId : null,
    block_id: typeof raw?.blockId === 'string' ? raw.blockId.slice(0, 100) : null,
    document_text: body,
    document_sha256: documentHash(body),
    document_title: title,
    typed_name: typedName,
    email,
    consented_electronic: true,
    visitor_ip: clientIp(req),
    user_agent: (req.headers.get('user-agent') ?? '').slice(0, 400) || null,
  });

  if (error) {
    return NextResponse.json({ error: 'Something went wrong. Nothing was recorded.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
