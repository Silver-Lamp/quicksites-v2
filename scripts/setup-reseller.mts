// scripts/setup-reseller.mts — stand up a white-label reseller for a named person, in one step.
//
//   npx tsx --env-file=.env.local scripts/setup-reseller.mts \
//     --email daniel@example.com --name "Daniel Russo" --org "ScaleUp Software" \
//     --code daniel [--support-email hello@scaleup.example] [--apply]
//
// Dry-run by default: prints what it would do. With --apply it:
//   1. finds or creates the user (confirmed, no password; a magic sign-in link is printed),
//   2. makes `--code` THAT user's partner code — `owner_type='provider_rep'`, plan = the standard
//      order-fee share (lib/commerce/partner-terms.ts), lifetime — converting an existing unowned
//      affiliate code IN PLACE so the code string, the `?ref=` link and any attributions already
//      recorded under it survive (the /for-daniel page promised the code `daniel`, a lifetime
//      share, and "the top rate"; the partner share is the top rate, so this only ever raises it),
//   3. creates the reseller org with that user as owner (the same `upsertPartnerOrg` the partner
//      dashboard uses, so /partners/dashboard shows brand → domain → email → payouts → share
//      ready for him to finish).
// It never lowers a rate, never re-owns a code that belongs to someone else, never deletes.
import { createClient } from '@supabase/supabase-js';
import { upsertPartnerOrg, getPartnerOrg } from '../lib/partners/whiteLabel';
import { PARTNER_FEE_SHARE, MAX_PLATFORM_FEE_PERCENT, RESIDUAL_MONTHS } from '../lib/commerce/partner-terms';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const apply = args.includes('--apply');
const email = opt('email')?.trim().toLowerCase();
const name = opt('name')?.trim() || '';
const orgName = opt('org')?.trim() || '';
const code = (opt('code') ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const supportEmail = opt('support-email')?.trim().toLowerCase() || null;
if (!email || !orgName || !code) throw new Error('--email, --org and --code are required');

const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.quicksites.ai';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, { auth: { persistSession: false } });

// 1. The user.
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
let user = list?.users.find((u) => (u.email ?? '').toLowerCase() === email) ?? null;
console.log(user ? `user exists: ${user.id} (${email})` : `user: would create ${email}${name ? ` (${name})` : ''}`);

// 2. The code.
const { data: codeRow } = await admin.from('referral_codes').select('code, owner_type, owner_id, plan, label, status').eq('code', code).maybeSingle();
const plan = { type: 'order_fee_share', partner_share: PARTNER_FEE_SHARE, max_platform_fee_percent: MAX_PLATFORM_FEE_PERCENT, residual_months: RESIDUAL_MONTHS };
if (codeRow?.owner_id && user && codeRow.owner_id !== user.id) throw new Error(`code ${code} is owned by another user (${codeRow.owner_id}); refusing`);
if (codeRow?.owner_id && !user) throw new Error(`code ${code} is already owned (${codeRow.owner_id}) and ${email} has no account; refusing`);
console.log(codeRow ? `code ${code}: ${codeRow.owner_type} ${JSON.stringify(codeRow.plan)} → provider_rep ${JSON.stringify(plan)}` : `code ${code}: would create as provider_rep ${JSON.stringify(plan)}`);
const { count: attributed } = await admin.from('attributions').select('*', { count: 'exact', head: true }).eq('referral_code', code);
console.log(`attributions already under ${code}: ${attributed ?? 0} (preserved — the row is updated in place)`);

// 3. The org.
console.log(`org: ${orgName} (reseller), owner = ${email}${supportEmail ? `, support ${supportEmail}` : ''}`);

if (!apply) { console.log('\nDRY RUN — re-run with --apply'); process.exit(0); }

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: name ? { name } : undefined });
  if (error) throw new Error(`createUser: ${error.message}`);
  user = data.user;
  console.log(`created user ${user.id}`);
}
const patch = { owner_type: 'provider_rep', owner_id: user.id, plan, label: name ? `${name} (${orgName})` : orgName, owner_email: email, status: 'active', claimed_at: new Date().toISOString() };
if (codeRow) {
  const { error } = await admin.from('referral_codes').update(patch).eq('code', code);
  if (error) throw new Error(`update code: ${error.message}`);
} else {
  const { error } = await admin.from('referral_codes').insert({ code, ...patch, created_by: user.id });
  if (error) throw new Error(`insert code: ${error.message}`);
}
console.log(`code ${code} → provider_rep, owner ${user.id}`);

const existingOrg = await getPartnerOrg(user.id);
const org = existingOrg ?? (await upsertPartnerOrg(user.id, { name: orgName, support_email: supportEmail }));
console.log(`org ${org.slug} (${org.id}) ${existingOrg ? 'already existed' : 'created'}; billing_mode=${(org as any).billing_mode}`);

const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: `${base}/auth/callback?next=/partners/dashboard` } });
if (linkErr) console.log(`magic link: ${linkErr.message}`);
else console.log(`\nSign-in link for ${email} (single use, send privately):\n${link.properties?.action_link}\n`);
console.log(`Next for him on /partners/dashboard: logo → portal domain → sending domain → Stripe payouts → share. His code: ${code} · link ${base}/?ref=${code}`);
