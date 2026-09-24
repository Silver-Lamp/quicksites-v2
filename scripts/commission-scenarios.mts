// scripts/commission-scenarios.mts
//
// Decision aid for the two open questions in docs/RENTAL_SPLITS.md:
//   1. What is the head of BD's override rate on the commerce rail?
//   2. Do rentals get a second level, and whose share funds it?
//
// Spends nothing, touches no DB, changes no state. Every figure comes from the SAME functions the
// payment path uses (`splitRentalPayment`, `partnerCommissionCents`, `affiliateResidualCents`,
// `allocateUplineOverrides`), so a scenario here is what the system would actually pay.
//
//   npx tsx --env-file=.env.local scripts/commission-scenarios.mts
//   npx tsx --env-file=.env.local scripts/commission-scenarios.mts --merchants=25 --rentals=10
//
// ⚠️ THE ONE THING TO CARRY AWAY BEFORE READING ANY ROW: on commerce, every override shares ONE
// slice — QS_FEE_SHARE (20%) of the platform fee — because the reseller's 80% is protected in code.
// On rentals, every override shares the HOUSE remainder (~25% of net). Both rails therefore trade
// the same way: a level added anywhere comes out of the house, never out of the closer.

import {
  AFFILIATE_MAX_FEE_SHARE,
  MAX_PLATFORM_FEE_PERCENT,
  PARTNER_FEE_SHARE,
  QS_FEE_SHARE,
  affiliateResidualCents,
  partnerCommissionCents,
} from '@/lib/commerce/partner-terms';
import { SPLIT, splitRentalPayment } from '@/lib/commerce/rentalSplits';
import { allocateUplineOverrides } from '@/lib/commerce/uplineChain';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const MERCHANTS = Number(arg('merchants') ?? 10);
const RENTALS = Number(arg('rentals') ?? 10);

const GMV_CENTS = 1_000_000; // $10k/month of online orders — a busy small independent
const FEE_PCT = 0.05; // a typical platform fee; cap is MAX_PLATFORM_FEE_PERCENT
const AVG_ORDER_CENTS = 4_500; // $45 — matters only for the affiliate net-safety cap

const m = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pad = (s: string, n: number) => s.padEnd(n);
const rpad = (s: string, n: number) => s.padStart(n);
const rule = (n = 92) => console.log('─'.repeat(n));

function header(t: string) {
  console.log(`\n\n${t}`);
  rule();
}

// ───────────────────────────────── the commerce rail ─────────────────────────────────

const feeCents = Math.round(GMV_CENTS * FEE_PCT);
const resellerCents = partnerCommissionCents(feeCents);
// ⚠️ ROUNDED to match `allocateUplineOverrides`'s budget exactly. Flooring here (while the allocator
// rounds) printed a house share of −$0.01 on a configuration that in fact lands precisely on 20%:
// the reference number was wrong, not the payment. Two definitions of "the slice" is how a report
// accuses correct code of overpaying.
const sliceCents = Math.round(feeCents * QS_FEE_SHARE);

function commerceRail() {
  header('COMMERCE — one merchant doing $10,000/month of orders at a 5% platform fee');
  console.log(`Platform fee                       ${rpad(m(feeCents), 12)}   (cap is ${Math.round(MAX_PLATFORM_FEE_PERCENT * 100)}% of the order)`);
  console.log(`Reseller who signed them up keeps  ${rpad(m(resellerCents), 12)}   ${Math.round(PARTNER_FEE_SHARE * 100)}% — protected in code, untouchable`);
  console.log(`Everything else                    ${rpad(m(sliceCents), 12)}   ${Math.round(QS_FEE_SHARE * 100)}% — Amy, any middle level, AND the house`);

  console.log('\n⚠️  That last line is the whole decision. Amy is not paid "out of the fee";');
  console.log('    she is paid out of the same ' + m(sliceCents) + ' that has to fund the business.\n');

  // Amy alone above the seller (the simple case, and the only one that exists today).
  console.log(pad('Amy alone above the seller', 30) + rpad('Amy/mo', 10) + rpad('house/mo', 11) + rpad(`× ${MERCHANTS} merchants`, 16) + rpad('house/yr', 14));
  rule();
  for (const share of [0.02, 0.05, 0.1, 0.15, QS_FEE_SHARE]) {
    const a = allocateUplineOverrides(feeCents, [{ code: 'amy', overrideShare: share }], QS_FEE_SHARE);
    const amy = a.totalCents;
    const house = sliceCents - amy;
    const label = `${(share * 100).toFixed(0)}% of the fee` + (share === QS_FEE_SHARE ? '  (the ceiling)' : '');
    console.log(
      pad(label, 30) + rpad(m(amy), 10) + rpad(m(house), 11) + rpad(m(amy * MERCHANTS), 16) + rpad(m(house * MERCHANTS * 12), 14)
    );
  }
  console.log('\n    At the ceiling the house earns nothing at all — that is not a rate, it is the edge.');

  // Two levels: Daryle directly above the seller, Amy above Daryle.
  header('COMMERCE — a real chain: seller → Daryle → Amy (this is what you asked for)');
  console.log(pad('Daryle', 14) + pad('Amy', 14) + rpad('Daryle', 10) + rpad('Amy', 10) + rpad('house', 10) + '   what actually happens');
  rule();
  for (const [dShare, aShare] of [
    [0.05, 0.05],
    [0.1, 0.05],
    [0.1, 0.1],
    [0.15, 0.05],
    [0.15, 0.1],
    [QS_FEE_SHARE, 0.05],
  ] as const) {
    const a = allocateUplineOverrides(
      feeCents,
      [
        { code: 'daryle', overrideShare: dShare },
        { code: 'amy', overrideShare: aShare },
      ],
      QS_FEE_SHARE
    );
    const paid = new Map(a.payments.map((p) => [p.code, p.cents]));
    const house = sliceCents - a.totalCents;
    const note = a.shorted.length
      ? `⛔ ${a.shorted.map((s) => s.code).join(', ')} paid NOTHING — over the slice`
      : house === 0
        ? '⚠️  house at zero'
        : 'fits';
    console.log(
      pad(`${(dShare * 100).toFixed(0)}%`, 14) +
        pad(`${(aShare * 100).toFixed(0)}%`, 14) +
        rpad(m(paid.get('daryle') ?? 0), 10) +
        rpad(m(paid.get('amy') ?? 0), 10) +
        rpad(m(house), 10) +
        '   ' + note
    );
  }
  console.log('\n    Nearest-first: Daryle is paid his agreed rate, and Amy takes what is left.');
  console.log('    Set Daryle at the ceiling and Amy earns ZERO, however senior she is.');

  // The tier point — the thing that actually moves the number.
  header('COMMERCE — the lever that matters more than Amy\'s rate: which TIER her people are');
  const affCents = affiliateResidualCents(feeCents, AVG_ORDER_CENTS, 0.25);
  const affMaxCents = affiliateResidualCents(feeCents, AVG_ORDER_CENTS, AFFILIATE_MAX_FEE_SHARE);
  console.log(`Reseller (operates the account, ${Math.round(PARTNER_FEE_SHARE * 100)}%)  keeps ${m(resellerCents)}  → leaves ${m(sliceCents)} for Amy + house`);
  console.log(`Affiliate at 25% (just refers)          keeps ${m(affCents)}  → leaves ${m(feeCents - affCents)} for Amy + house`);
  console.log(`Affiliate at ${Math.round(AFFILIATE_MAX_FEE_SHARE * 100)}% (the cap)            keeps ${m(affMaxCents)}  → leaves ${m(feeCents - affMaxCents)} for Amy + house`);
  console.log('\n⚠️  An AFFILIATE downline leaves ' + m(feeCents - affCents) + ' to share instead of ' + m(sliceCents) + '.');
  console.log('    So "what tier does Amy recruit into" changes her ceiling by more than tripling her rate would.');
  console.log('    ⚠️  But the code currently caps ALL overrides at ' + Math.round(QS_FEE_SHARE * 100) + '% of the fee regardless of tier —');
  console.log('        deliberately conservative. Raising that for affiliate downlines is a THIRD decision,');
  console.log('        not an oversight, and it is the cheapest way to pay Amy more without costing the house.');
}

// ───────────────────────────────── the rental rail ─────────────────────────────────

function rentalRail() {
  const r = splitRentalPayment(9_900, 'recruit');
  header('RENTALS — one $99/month rental, closed by someone Amy recruited (today, one level)');
  console.log(`Customer pays                      ${rpad(m(r.grossCents), 12)}`);
  console.log(`Stripe                             ${rpad('− ' + m(r.feeCents), 12)}`);
  console.log(`Net                                ${rpad(m(r.netCents), 12)}   every share below comes from this`);
  console.log(`Closer                             ${rpad(m(r.closerCents), 12)}   ${Math.round(SPLIT.closer * 100)}% — protected, never funds an override`);
  console.log(`Amy as the manager                 ${rpad(m(r.managerCents), 12)}   ${Math.round(SPLIT.managerRecruit * 100)}% (recruit rate)`);
  console.log(`House                              ${rpad(m(r.houseCents), 12)}   ← a SECOND level can only come from here`);

  console.log('\n\nRENTALS — what a second level would cost, if Amy sits above the manager');
  rule();
  console.log(pad('Amy (2nd level)', 22) + rpad('Amy', 10) + rpad('house', 10) + rpad(`× ${RENTALS} rentals/mo`, 18) + rpad('house/yr', 14));
  rule();
  for (const share of [0.05, 0.1, 0.15, 0.2]) {
    const amy = Math.floor(r.netCents * share);
    const house = r.houseCents - amy;
    const flag = house < 0 ? '  ⛔ house underwater' : house < r.netCents * 0.1 ? '  ⚠️ thin' : '';
    console.log(
      pad(`${(share * 100).toFixed(0)}% of net`, 22) +
        rpad(m(amy), 10) +
        rpad(m(house), 10) +
        rpad(m(amy * RENTALS), 18) +
        rpad(m(house * RENTALS * 12), 14) +
        flag
    );
  }
  console.log('\n⚠️  The house keeps ' + m(r.houseCents) + ' of a $99 rental — and that is what buys the domains,');
  console.log('    pays for hosting, and funds the work of getting them to rank. A second level at 15% of net');
  console.log('    leaves ' + m(r.houseCents - Math.floor(r.netCents * 0.15)) + ' per account to do all of that.');
  console.log('\n    This is why rentals were NOT given a second level in code: it is not a build, it is this trade.');
}

function theQuestion() {
  header('SO, THE DECISION IN ONE PARAGRAPH');
  console.log('Commerce and rentals both protect the person who closed the sale, so every override on');
  console.log('both rails is funded from the house. The question is not "what does Amy deserve" — it is');
  console.log('"how much of the house share buys business development, versus buying the domains and the');
  console.log('hosting that make anything sellable at all".');
  console.log('\nThree things would each raise Amy\'s pay without touching the closer:');
  console.log('  1. A higher override rate            → straight out of the house, visible above.');
  console.log('  2. Recruiting AFFILIATES not resellers → leaves ' + m(feeCents - affiliateResidualCents(feeCents, AVG_ORDER_CENTS, 0.25)) + ' to share instead of ' + m(sliceCents) + '.');
  console.log('  3. Raising the override cap for affiliate downlines → currently ' + Math.round(QS_FEE_SHARE * 100) + '% for every tier.');
  console.log('\n⚠️  And the honest frame for all of it: nothing has paid anyone yet. commission_ledger is');
  console.log('    empty. Every number above is a rate on revenue that does not exist, so the cheapest');
  console.log('    decision today is the one that is easiest to REVISE once something sells — a rate in');
  console.log('    a column, not a promise in a conversation.');
}

commerceRail();
rentalRail();
theQuestion();
console.log('');
