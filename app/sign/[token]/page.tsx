// app/sign/[token]/page.tsx
//
// The page where someone reads an agreement and signs it.
//
// ⚠️ SERVER-RENDERED, WITH THE DOCUMENT IN THE HTML. This is a contract. It must be readable
// before JavaScript decides anything, printable, and legible on a phone — the token is in the URL,
// so what to show is known before the first byte.
//
// ⚠️ noindex. A private agreement between two named people, reachable by anyone holding the link.
import type { Metadata } from 'next';
import { verifySignToken } from '@/lib/agreements/signToken';
import { getAgreement, getSignature } from '@/lib/agreements/store';
import { documentHash } from '@/lib/agreements/document';
import SignClient from './sign-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Review and sign',
  robots: { index: false, follow: false },
};

function Dead({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-foreground">This link isn’t working</h1>
      <p className="mt-3 text-muted-foreground">{message}</p>
    </main>
  );
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verified = verifySignToken(token);
  if (!verified) {
    return <Dead message="It may have expired, or been replaced. Ask whoever sent it for a fresh link." />;
  }

  const agreement = await getAgreement(verified.agreementId);
  if (!agreement) return <Dead message="Ask whoever sent it for a fresh one." />;

  if (agreement.voided_at) {
    return (
      <Dead
        message={
          agreement.voided_reason
            ? `This agreement was withdrawn: ${agreement.voided_reason}`
            : 'This agreement was withdrawn. Ask whoever sent it for a current one.'
        }
      />
    );
  }

  const signature = await getSignature(agreement.id);

  return (
    <SignClient
      token={token}
      agreement={{
        title: agreement.title,
        bodyMd: agreement.body_md,
        partyName: agreement.party_name,
        partyEmail: agreement.party_email,
        signerName: agreement.signer_name,
        signerEmail: agreement.signer_email,
      }}
      // Computed server-side from the same column the body above is rendered from, so the
      // fingerprint on screen is provably of the text on screen.
      documentSha256={documentHash(agreement.body_md)}
      alreadySigned={
        signature
          ? { typedName: signature.typed_name, signedAt: signature.signed_at }
          : null
      }
    />
  );
}
