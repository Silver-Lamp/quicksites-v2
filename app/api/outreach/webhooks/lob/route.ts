// app/api/outreach/webhooks/lob/route.ts
//
// Inbound Lob delivery webhook → advance the matching postcard_mailings row through the
// USPS tracking lifecycle (in_transit → … → delivered / returned_to_sender). Correlated
// by the Lob postcard id persisted at send time.
//
// Verifies the HMAC signature (Lob-Signature over `${timestamp}.${body}` with
// LOB_WEBHOOK_SECRET). FAILS CLOSED in production when the secret is unset — matching the
// Lulu-webhook hardening (an unauthenticated status endpoint is a spoofing vector).

import { NextRequest, NextResponse } from 'next/server';
import { lobWebhookSecret } from '@/lib/outreach/mail/lob';
import { verifyLobSignature, mapLobEventToStatus } from '@/lib/outreach/mail/lobWebhook';
import { applyLobEvent } from '@/lib/outreach/mail/mailings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = lobWebhookSecret();

  if (!secret) {
    // No secret configured: reject in prod (fail closed); allow in dev for local testing.
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('webhook secret not configured', { status: 503 });
    }
  } else {
    const ok = verifyLobSignature({
      rawBody: raw,
      signature: req.headers.get('lob-signature'),
      timestamp: req.headers.get('lob-signature-timestamp'),
      secret,
    });
    if (!ok) return new NextResponse('bad signature', { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse('bad payload', { status: 400 });
  }

  // Lob webhook envelope: { event_type: { id }, body: <postcard>, date_created, ... }.
  const eventTypeId: string | null = payload?.event_type?.id ?? payload?.event_type ?? null;
  const postcard = payload?.body ?? {};
  const lobId: string = String(postcard?.id ?? payload?.reference_id ?? '');
  const status = mapLobEventToStatus(eventTypeId);

  if (lobId && status) {
    try {
      await applyLobEvent(lobId, {
        status,
        eventTypeId,
        occurredAt: payload?.date_created ?? null,
        expectedDeliveryDate: postcard?.expected_delivery_date ?? null,
        raw: { event: eventTypeId },
      });
    } catch (e: any) {
      // Ack anyway so Lob doesn't hammer retries on a transient DB blip.
      console.warn('[lob webhook] applyLobEvent failed:', e?.message || e);
    }
  }

  return new NextResponse('ok', { status: 200 });
}
