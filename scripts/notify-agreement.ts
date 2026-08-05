// scripts/notify-agreement.ts
//
// Send (or re-send) the "this was signed" notices for an agreement that is already signed.
//
//   npx tsx --env-file=.env.local scripts/notify-agreement.ts <agreement-id> --dry-run
//   npx tsx --env-file=.env.local scripts/notify-agreement.ts <agreement-id>
//
// ⚠️ --dry-run IS THE DEFAULT-SAFE PATH AND IT WORKS BY REMOVING THE API KEY, NOT BY A FLAG THE
// SEND PATH CHECKS. A dry run that asks the mailer nicely not to send is one refactor away from
// emailing a real person by accident; deleting RESEND_API_KEY before the mailer module is even
// imported makes sending impossible rather than discouraged. This is why the import below is
// dynamic — lib/email.ts binds the key at module load, so a static import would capture it first.
//
// Exists because notification was added AFTER the first real agreement was signed: the signature
// is valid and nobody was told. Backfilling is a real need, and it will be again any time a send
// fails (`notify_error` on the row).

async function main() {
  const agreementId = process.argv[2];
  if (!agreementId || agreementId.startsWith('--')) {
    throw new Error('usage: notify-agreement.ts <agreement-id> [--dry-run]');
  }
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    // Before ANY import that might bind it.
    delete process.env.RESEND_API_KEY;
    console.log('\n  DRY RUN — the mailer has no API key, so nothing can be sent.\n');
  }

  const { getAgreement, getSignature } = await import('../lib/agreements/store');
  const { notifySigned } = await import('../lib/agreements/notify');

  const agreement = await getAgreement(agreementId);
  if (!agreement) throw new Error(`no agreement ${agreementId}`);
  const signature = await getSignature(agreementId);
  if (!signature) throw new Error(`agreement ${agreementId} is not signed — nothing to notify`);

  console.log(`  agreement   ${agreement.title}`);
  console.log(`  signed by   ${signature.typed_name} at ${signature.signed_at}`);
  console.log(`  → signer    ${agreement.signer_email}`);
  console.log(`  → party     ${agreement.party_email ?? '(none set — half the notice cannot be sent)'}`);
  console.log('');

  const result = await notifySigned(agreement, signature);
  console.log(result.ok ? '  sent.\n' : `  FAILED: ${result.error}\n`);

  if (dryRun) {
    console.log('  (dry run — notified_at/notify_error were still written, so re-run for real');
    console.log('   to clear a false failure state.)\n');
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
