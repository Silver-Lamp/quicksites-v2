// lib/commerce/roleLadder.ts
//
// WHO IS IN THE CHAIN, WHAT THEY ARE CALLED, WHAT THEY DO, AND WHAT THEY EARN.
//
// ⚠️ THIS EXISTS BECAUSE THE VOCABULARY WAS AMBIGUOUS AND IT COST A MEETING. On the 2026-09-30
// call Daryle described himself as *"in a sense, kind of the company because I'm white label"*
// and in the next breath said he would not be the one supporting merchants. Those are two
// different rungs with a 3× difference in pay, and neither of us noticed in the moment because
// the words for them were not settled. "Reseller", "partner", "hub" and "referrer" were each
// being used for more than one thing.
//
// ⚠️ THE LADDER IS DEFINED BY WHO SUPPORTS THE MERCHANT, NOT BY WHO SIGNED THEM UP. That single
// question decides the tier, the pool everyone above shares, and therefore every number below
// it. A sales org closing volume can out-earn an operator with a handful of accounts, so this
// is not a hierarchy of importance — it is a record of who carries which cost.
//
// ⚠️ EVERY NAME IS MARKED `established` OR NOT, AND THAT MATTERS MORE THAN THE NAMES. Three of
// these are real: `reseller`/operator and `affiliate` are `referral_codes.owner_type` values the
// payment path branches on, and "hub" is the word `set-hub` and CLAUDE.md already use. The
// deeper rungs have NO name anywhere in the system — they are `parent_code` links and nothing
// more. Naming them here is a proposal, and a proposal that gets quoted to an ISO becomes a
// promise, so the distinction is rendered on the page rather than buried.
import {
  PARTNER_FEE_SHARE,
  AFFILIATE_FEE_SHARE,
  QS_FEE_SHARE,
  ORIGINATION_UPLINE_POOL_SHARE,
  uplinePoolShare,
} from './partner-terms';
import { MAX_UPLINE_DEPTH, buildUplineChain, allocateUplineOverrides } from './uplineChain';

export type SellerTier = 'operator' | 'origination';

/**
 * Stand-in names for worked examples.
 *
 * ⚠️ PSEUDONYMS ON PURPOSE (owner direction, 2026-09-30). These pages get forwarded — that is
 * what `/for-<name>` is for — and a diagram showing a real person's position and earnings
 * travels further than the conversation that produced it. `Alice` stands in for the head of
 * business development and `Danny` for the channel recruiter; the rest are invented outright.
 *
 * ⚠️ The merchant is `Wildflower Candle Co.`, which is a REAL demo site we built and an invented
 * brand — so the example is checkable without naming anybody's actual customer.
 */
export const CAST = {
  merchant: 'Wildflower Candle Co.',
  /** Closes the merchant. */
  rep: 'Priya',
  /** A one-person shop that operates its own book. */
  soloOperator: 'Rosa’s Web Studio',
  /** A payments company with its own sales force. */
  iso: 'Northwind Payments',
  secondIso: 'Cascade Merchant Services',
  /** Recruits the ISOs — stands in for Daryle. */
  hub: 'Danny',
  /** Above the hub — stands in for Amy. */
  head: 'Alice',
} as const;

export type RoleRung = {
  /** 0 = the merchant, 1 = whoever's code is on the order, 2+ = uplines by distance. */
  level: number;
  name: string;
  /** What they actually do. The support question first, because it decides the money. */
  does: string;
  /** How they are paid, in words. */
  paidBy: string;
  /**
   * ⚠️ Is this name real, or are we proposing it?
   *
   * `owner_type` / `set-hub` for the first three; nothing for the rest. A name that only exists
   * in a diagram must not be quoted as though the system knows it.
   */
  established: string | null;
  /** Cents on the modelled order, once a scenario is applied. */
  cents?: number;
  /** True when the pool ran out before reaching this rung. */
  shorted?: boolean;
  /** Stand-in name for a worked example. Never a real person — see CAST. */
  persona?: string;
};

/**
 * The cast in ladder order for the ISO scenario from the 2026-09-30 call:
 * merchant → rep who closes → their ISO → the hub who recruited the ISO → the head above them.
 */
export const ISO_PERSONAS = [CAST.merchant, CAST.rep, CAST.iso, CAST.hub, CAST.head];

/** The simpler one: a solo shop that operates its own merchants, recruited by the hub. */
export const SOLO_PERSONAS = [CAST.merchant, CAST.soloOperator, CAST.hub, CAST.head];

/**
 * The ladder, with no money on it yet.
 *
 * `uplineLevels` is how many rungs to draw above the seller. The hard ceiling is
 * `MAX_UPLINE_DEPTH` — a bound on the WALK, not a business rule, so that one malformed
 * `parent_code` cannot turn a paid order into an unbounded loop inside the Stripe webhook.
 */
export function buildRoleLadder(opts: {
  tier: SellerTier;
  uplineLevels: number;
}): RoleRung[] {
  const levels = Math.max(0, Math.min(opts.uplineLevels, MAX_UPLINE_DEPTH));
  const operator = opts.tier === 'operator';

  const rungs: RoleRung[] = [
    {
      level: 0,
      name: 'Merchant',
      does: 'Sells to the public. Pays the platform fee on each order — every figure above comes out of that one number and nowhere else.',
      paidBy: 'Earns nothing from us; they are the source of the fee.',
      established: 'merchants table',
    },
    operator
      ? {
          level: 1,
          name: 'Operator',
          does: 'Onboards the merchant, puts their own brand on it, and SUPPORTS them — they are who the merchant calls when checkout breaks.',
          paidBy: `${pct(PARTNER_FEE_SHARE)} of every fee, for the life of the account. The large share is what pays for the support.`,
          established: "referral_codes.owner_type ≠ 'qs_affiliate'",
        }
      : {
          level: 1,
          name: 'Originator',
          does: 'Brings the merchant and moves on. QuickSites supports them.',
          paidBy: `${pct(AFFILIATE_FEE_SHARE)} of every fee, for the life of the account. Smaller because they are not carrying the support cost.`,
          established: "referral_codes.owner_type = 'qs_affiliate'",
        },
  ];

  for (let i = 1; i <= levels; i++) {
    rungs.push({
      level: 1 + i,
      ...uplineRole(i),
    });
  }
  return rungs;
}

function uplineRole(distance: number): Pick<RoleRung, 'name' | 'does' | 'paidBy' | 'established'> {
  const paidBy =
    'A configurable share of the fee, drawn from the pool above — never from the share of anyone below them.';
  if (distance === 1) {
    return {
      name: 'Manager',
      does: 'Recruits and supports the person who sells. Does not touch the merchant.',
      paidBy,
      // ⚠️ Real on the RENTAL rail only (rentalSplits.ts managerStandard / managerRecruit).
      // On commerce it is just a parent_code, so the word is borrowed, not defined.
      established: 'rentals only (rentalSplits.ts) — on commerce it is only a parent_code',
    };
  }
  if (distance === 2) {
    return {
      name: 'Hub',
      does: 'Recruits the people who recruit sellers. Brings a channel rather than an account.',
      paidBy,
      established: 'set-hub route + CLAUDE.md',
    };
  }
  return {
    name: `Upline level ${distance}`,
    does: 'Sits above the hub. Recruited someone, somewhere down the chain.',
    paidBy,
    // ⚠️ No name exists for this anywhere in the system. Saying so on the page is the point.
    established: null,
  };
}

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

export type LadderScenario = {
  /** Merchant's monthly order volume, in cents. */
  monthlyVolumeCents: number;
  /** Platform fee as a fraction of volume. */
  feePercent: number;
  tier: SellerTier;
  /** Each upline's requested share OF THE FEE, nearest the sale first. */
  uplineShares: number[];
  /** Optional stand-in names, merchant first. See CAST — never real people. */
  personas?: readonly string[];
};

export type LadderResult = {
  rungs: RoleRung[];
  feeCents: number;
  poolCents: number;
  houseCents: number;
  /** ⚠️ Non-empty means someone is configured for a rate this order cannot pay. */
  shortedNames: string[];
};

/**
 * Put money on the ladder, using the SAME allocator the payment path uses.
 *
 * ⚠️ Nearest-first, so a rung that does not fit is paid NOTHING rather than a reduced rate —
 * which means the person FURTHEST from the sale is the first to earn zero. That is the least
 * intuitive property of the whole design and the one most likely to be promised away, so it is
 * returned explicitly rather than left to be noticed in a total.
 */
export function applyLadderScenario(s: LadderScenario): LadderResult {
  const ownerType = s.tier === 'operator' ? 'provider_rep' : 'qs_affiliate';
  const feeCents = Math.round(s.monthlyVolumeCents * s.feePercent);
  const sellerShare = s.tier === 'operator' ? PARTNER_FEE_SHARE : AFFILIATE_FEE_SHARE;
  const sellerCents = Math.floor(feeCents * sellerShare);
  const pool = uplinePoolShare(ownerType);

  // Model the chain exactly as the DB would hold it: each code names its parent, and the share
  // stored on a code is what its PARENT earns when it sells.
  const codes = s.uplineShares.map((_, i) => `u${i + 1}`);
  const nodes: Record<string, { parentCode: string | null; overrideShare: number }> = {
    seller: { parentCode: codes[0] ?? null, overrideShare: s.uplineShares[0] ?? 0 },
  };
  codes.forEach((c, i) => {
    nodes[c] = { parentCode: codes[i + 1] ?? null, overrideShare: s.uplineShares[i + 1] ?? 0 };
  });

  const chain = buildUplineChain('seller', (c) => nodes[c]);
  const alloc = allocateUplineOverrides(feeCents, chain, pool);

  const rungs = buildRoleLadder({ tier: s.tier, uplineLevels: s.uplineShares.length });
  rungs[0].cents = 0;
  rungs[1].cents = sellerCents;
  codes.forEach((c, i) => {
    const rung = rungs[2 + i];
    if (!rung) return;
    rung.cents = alloc.payments.find((p) => p.code === c)?.cents ?? 0;
    rung.shorted = alloc.shorted.some((x) => x.code === c);
  });

  if (s.personas) rungs.forEach((r, i) => { r.persona = s.personas![i]; });

  return {
    rungs,
    feeCents,
    poolCents: Math.round(feeCents * pool),
    houseCents: feeCents - sellerCents - alloc.totalCents,
    shortedNames: rungs.filter((r) => r.shorted).map((r) => r.name),
  };
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

/**
 * Mermaid source for the ladder, generated from the SAME result the page renders.
 *
 * ⚠️ Generated, never hand-written. A diagram maintained separately from the numbers drifts from
 * them, and this one is meant to be pasted into a deck or a doc where nobody can check it against
 * the code. `components/home/reseller-diagram.tsx` keeps its mermaid as a comment for exactly the
 * opposite reason — that one is decorative and static; this one carries figures.
 */
export function ladderMermaid(result: LadderResult, opts?: { monthlyLabel?: string }): string {
  const per = opts?.monthlyLabel ?? 'per month';
  const lines: string[] = ['graph BT'];
  const id = (i: number) => `L${i}`;

  result.rungs.forEach((r, i) => {
    const money =
      r.level === 0
        ? `pays ${usd(result.feeCents)} ${per}`
        : r.shorted
          ? 'PAID NOTHING — pool ran out'
          : `${usd(r.cents ?? 0)} ${per}`;
    const who = r.persona ? `${escapeMermaid(r.persona)}<br/><small>${escapeMermaid(r.name)}</small>` : escapeMermaid(r.name);
    lines.push(`  ${id(i)}["${who}<br/><small>${escapeMermaid(money)}</small>"]`);
  });

  result.rungs.forEach((_, i) => {
    if (i === 0) return;
    lines.push(`  ${id(i - 1)} --> ${id(i)}`);
  });

  lines.push(`  HOUSE["QuickSites<br/><small>${usd(result.houseCents)} ${per}</small>"]`);
  lines.push(`  ${id(1)} -.-> HOUSE`);
  result.rungs.forEach((r, i) => {
    if (r.shorted) lines.push(`  style ${id(i)} fill:#4c1d24,stroke:#f43f5e,color:#fecdd3`);
  });
  if (result.houseCents <= 0) lines.push('  style HOUSE fill:#4c1d24,stroke:#f43f5e,color:#fecdd3');
  return lines.join('\n');
}

/** Mermaid node labels are quoted; a stray quote or bracket ends the label early. */
function escapeMermaid(s: string): string {
  return s.replace(/"/g, "'").replace(/[[\]{}]/g, '');
}

export { MAX_UPLINE_DEPTH, QS_FEE_SHARE, ORIGINATION_UPLINE_POOL_SHARE };
