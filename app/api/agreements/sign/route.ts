// app/api/agreements/sign/route.ts
//
// Record a signature, and hand back the signed copy.
//
// ⚠️ THE AGREEMENT ID COMES FROM INSIDE THE TOKEN, NEVER FROM THE BODY. A token that authorises
// "an agreement" plus a body naming "which agreement" is the shape of every IDOR bug ever written.
import { NextResponse } from 'next/server';
import { verifySignToken } from '@/lib/agreements/signToken';
import { recordSignature, getSignature, getAgreement } from '@/lib/agreements/store';
import { agreementCertificateHtml } from '@/lib/agreements/certificate';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { clientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Public endpoint reachable by anyone holding a link: throttled per IP like every other one.
  const limited = await rateLimitOr429(req, 'agreement_sign', 20, 3600);
  if (limited) return limited;

  const body = await req.json().catch(() => ({} as any));
  const verified = verifySignToken(String(body?.token ?? ''));
  if (!verified) {
    // Deliberately vague: whether an agreement exists is not something a holder of a bad link
    // should learn.
    return NextResponse.json({ error: 'This signing link isn’t working.' }, { status: 400 });
  }

  const result = await recordSignature(verified.agreementId, {
    typedName: String(body?.typedName ?? ''),
    consentedElectronic: body?.consent === true,
    signerIp: clientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  if (!result.ok) {
    const message: Record<string, string> = {
      not_found: 'This signing link isn’t working.',
      voided: 'This agreement was withdrawn. Ask whoever sent it for a current one.',
      already_signed: 'This agreement has already been signed.',
      no_consent: 'Please confirm you agree to sign electronically.',
      no_name: 'Type your full name to sign.',
      error: 'Something went wrong. Nothing was recorded — please try again.',
    };
    return NextResponse.json(
      { error: message[result.reason] ?? message.error, code: result.reason },
      { status: result.reason === 'error' ? 500 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    signedAt: result.signature.signed_at,
    documentSha256: result.signature.document_sha256,
  });
}

/**
 * The signed copy, as a download.
 *
 * ⚠️ AVAILABLE TO THE TOKEN HOLDER FOREVER, NOT ONCE. Someone who loses the emailed copy must be
 * able to get it back without asking us — a signing product that makes the weaker party petition
 * the stronger one for evidence of what was agreed has the incentives exactly backwards.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const verified = verifySignToken(token);
  if (!verified) {
    return NextResponse.json({ error: 'This signing link isn’t working.' }, { status: 400 });
  }

  const [agreement, signature] = await Promise.all([
    getAgreement(verified.agreementId),
    getSignature(verified.agreementId),
  ]);
  if (!agreement) {
    return NextResponse.json({ error: 'This signing link isn’t working.' }, { status: 400 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'This agreement has not been signed yet.' }, { status: 409 });
  }

  const html = agreementCertificateHtml({
    title: agreement.title,
    bodyText: agreement.body_md,
    documentSha256: signature.document_sha256,
    partyName: agreement.party_name,
    partyEmail: agreement.party_email,
    signerName: agreement.signer_name,
    signerEmail: agreement.signer_email,
    typedName: signature.typed_name,
    signedAtIso: signature.signed_at,
    signerIp: signature.signer_ip,
    userAgent: signature.user_agent,
  });

  const filename = agreement.title.toLowerCase().replace(/[^\w-]+/g, '-').slice(0, 60) || 'agreement';
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}-signed.html"`,
      'Cache-Control': 'no-store, private',
    },
  });
}
