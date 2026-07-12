// app/api/admin/prospects/test-recipient/route.ts
//
// Read/set the single "mail my live test here" postcard address (site_settings). Admin-gated.
//   GET  -> { recipient: TestRecipient | null }
//   POST -> { name?, line1, line2?, city, state, zip }  (or { clear: true })

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getTestRecipient, setTestRecipient, type TestRecipient } from '@/lib/outreach/mail/testRecipient';
import { parseUsAddress } from '@/lib/outreach/mail/lob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true, recipient: await getTestRecipient() });
}

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (body.clear) {
    await setTestRecipient(null, operator.id);
    return NextResponse.json({ ok: true, recipient: null });
  }

  // Accept either structured fields or a single "Street, City, ST ZIP" string.
  let line1 = String(body.line1 ?? '').trim();
  let city = String(body.city ?? '').trim();
  let state = String(body.state ?? '').trim().toUpperCase();
  let zip = String(body.zip ?? '').trim();
  if ((!line1 || !city || !state || !zip) && body.formatted) {
    const parsed = parseUsAddress(String(body.formatted));
    if (!parsed) {
      return NextResponse.json({ error: 'Could not parse that address. Use "Street, City, ST ZIP".' }, { status: 400 });
    }
    ({ line1, city, state, zip } = parsed);
  }

  const r: TestRecipient = {
    name: String(body.name ?? 'Test Recipient').trim() || 'Test Recipient',
    line1,
    line2: body.line2 ? String(body.line2).trim() : null,
    city,
    state,
    zip,
  };
  if (!r.line1 || !r.city || !r.state || !r.zip) {
    return NextResponse.json({ error: 'line1, city, state, and zip are required.' }, { status: 400 });
  }
  await setTestRecipient(r, operator.id);
  return NextResponse.json({ ok: true, recipient: r });
}
