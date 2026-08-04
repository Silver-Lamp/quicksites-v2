// scripts/create-agreement.ts
//
// Create an agreement from a markdown file and print its signing link.
//
//   npx tsx --env-file=.env.local scripts/create-agreement.ts \
//     --file ./agreement.md \
//     --title "Volunteer Contributor Agreement" \
//     --signer "Eiji Kimura" --email eiji@example.com \
//     [--party "Point Seven Studio LLC"] [--party-email sandon@pointsevenstudio.com]
//
// ⚠️ THE OPERATOR ENTRY POINT IS A SCRIPT ON PURPOSE, FOR NOW. Creating an agreement is a
// deliberate act with a real person's name on it, and a script forces you to have the document in
// front of you as a file. An admin UI is the obvious next step; it should not be the first one,
// because the fastest way to send someone the wrong contract is a form that makes it easy.
//
// ⚠️ THE DOCUMENT FILE IS THE RECORD. Whatever is in it is what gets hashed and what the signer
// sees. Read it before running this — the text is frozen the moment anyone signs (enforced by a
// database trigger), so a typo becomes a new agreement rather than an edit.
import { readFileSync } from 'node:fs';
import { createAgreement } from '../lib/agreements/store';
import { mintSignToken } from '../lib/agreements/signToken';
import { documentHash, shortHash } from '../lib/agreements/document';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = arg('file');
  const title = arg('title');
  const signer = arg('signer');
  const email = arg('email');
  if (!file || !title || !signer || !email) {
    throw new Error(
      'usage: create-agreement.ts --file <md> --title <t> --signer <name> --email <addr> [--party <n>] [--party-email <addr>]',
    );
  }

  const bodyMd = readFileSync(file, 'utf8');

  const agreement = await createAgreement({
    title,
    bodyMd,
    partyName: arg('party') ?? 'Point Seven Studio LLC',
    partyEmail: arg('party-email') ?? null,
    signerName: signer,
    signerEmail: email,
  });
  if (!agreement) throw new Error('createAgreement returned null — check Supabase env vars');

  const token = mintSignToken(agreement.id);
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.quicksites.ai';
  const hash = documentHash(bodyMd);

  console.log('');
  console.log(`  agreement   ${agreement.id}`);
  console.log(`  signer      ${signer} <${email}>`);
  console.log(`  fingerprint ${shortHash(hash)}  (${hash})`);
  console.log('');
  console.log(`  ${base}/sign/${token}`);
  console.log('');
  console.log('  ⚠️  That link is the credential. Anyone holding it can sign as this person —');
  console.log('     send it to the signer directly, not to a shared inbox or a channel.');
  console.log('');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
