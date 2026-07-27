/**
 * @jest-environment node
 */
// Rule 7a of the adopted config standard: **a presence check only sees the keys it was told
// about.** PorchHearth's insight, and it closes the hole rule 7 leaves open — a health check
// that verifies *declared* keys is blind by construction to code reading a key that was never
// declared. It would report this app perfectly healthy while a guard did nothing.
//
// That is not hypothetical here. Two real bugs, both found the first time this cross-check
// was run by hand against this repo:
//
//   • /api/subscribe read `RECAPTCHA_SECRET`; the variable that exists is
//     `RECAPTCHA_SECRET_KEY`. The guard was `if (!token || !process.env.RECAPTCHA_SECRET)
//     return true` — fail-open, no signal, captcha silently off.
//   • .env.example declared `SUPABASE_SECRETlo_KEY` on the line commented "preferred new
//     server key". Nothing reads that name, so anyone setting the project up from the file
//     set a dead variable while the legacy fallback quietly covered for it.
//
// This runs as a TEST, not at boot, because it is a property of the SOURCE, not of the
// environment (PH's framing). It needs no env set to be meaningful.
//
// ── SCAN SCOPE IS A STATED DECISION, NOT AN ACCIDENT (PH's caveat) ───────────────────────
// The cross-check is only as complete as what it looks at. A key that appears undeclared may
// simply be read somewhere this scan doesn't cover. We scan `app/`, `lib/`, `components/`
// and `middleware.ts` — the request-serving surface, where a missing var fails silently in
// production. `scripts/` is deliberately excluded: tooling fails loudly at a command line,
// which is a different risk profile and doesn't need this guard.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { CONFIG_GATES } from '@/lib/config/health';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'lib', 'components'];
const SCAN_FILES = ['middleware.ts', 'instrumentation.ts'];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e === '__tests__' || e.startsWith('.')) continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/** Every `process.env.X` the request-serving source reads. */
function envKeysReadBySource(): Set<string> {
  const files = [
    ...SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))),
    ...SCAN_FILES.map((f) => join(ROOT, f)),
  ];
  const keys = new Set<string>();
  for (const f of files) {
    let src = '';
    try {
      src = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const m of src.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) keys.add(m[1]);
  }
  return keys;
}

function declaredInEnvExample(): Set<string> {
  try {
    const src = readFileSync(join(ROOT, '.env.example'), 'utf8');
    return new Set([...src.matchAll(/^([A-Z_][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]));
  } catch {
    return new Set();
  }
}

function declaredInGates(): Set<string> {
  const keys = new Set<string>();
  for (const g of CONFIG_GATES) {
    if (g.enabledBy) keys.add(g.enabledBy);
    g.requires.forEach((k) => keys.add(k));
    (g.requiresAnyOf ?? []).forEach((group) => group.forEach((k) => keys.add(k)));
  }
  return keys;
}

/**
 * Keys the source reads that are intentionally NOT health-checked and NOT in .env.example.
 *
 * ⚠️ Every entry needs a REAL reason. PH's own test rejected six entries reading
 * "As above." and two reading "Has a default." — without that discipline the allowlist just
 * becomes the new hiding place and you've recreated the original problem one level up. An
 * unexplained exclusion is indistinguishable from an oversight, which is the exact ambiguity
 * rule 7 exists to remove.
 */
const INTENTIONALLY_UNCHECKED: Record<string, string> = {
  NODE_ENV: 'Set by Node/Next itself; never configured by us and always present at runtime.',
  VERCEL: 'Injected by the Vercel runtime to signal the platform; not ours to set.',
  VERCEL_ENV: 'Injected by Vercel. Read by /status to resolve env_scope from the runtime.',
  VERCEL_REGION: 'Injected by Vercel. Cosmetic, surfaced in /status only.',
  VERCEL_URL: 'Injected by Vercel per-deployment; used only for absolute-URL fallbacks.',
  VERCEL_GIT_COMMIT_SHA: 'Injected by Vercel. Read by /status so a stale deploy is visible.',
  VERCEL_GIT_COMMIT_REF: 'Injected by Vercel. Shown in /status alongside the SHA.',
  GIT_COMMIT_SHA: 'Optional local/CI alternative to the Vercel SHA; absent is fine.',
  PORT: 'Set by the host process when running a server locally.',
  npm_package_version: 'Injected by npm; informational only.',
  ANALYZE: 'Local bundle-analyzer switch, developer machines only — never set in a deploy.',
  CI: 'Set by the CI runner to signal a non-interactive environment.',
};

/**
 * DEBT BASELINE — not an allowlist, and the distinction matters.
 *
 * This check landed on a repo that already read 110 env keys with only ~174 declared.
 * Triaging all of them at once would have meant either a 100+ key diff written in a hurry or
 * not shipping the check at all, so the existing gap is frozen here and the test fails on
 * anything NEW. That stops the problem growing today and makes the cleanup incremental.
 *
 * It is deliberately NOT the INTENTIONALLY_UNCHECKED list above: those entries are excused
 * forever with a reason, these are simply undone. Two rules keep this honest:
 *
 *   1. Adding a key here is not a fix. Prefer .env.example or a gate.
 *   2. The "baseline only shrinks" test below fails if a key here is now declared — so the
 *      list can never quietly become permanent, and every cleanup is enforced.
 *
 * Deliberately excluded from the baseline: RECAPTCHA_SECRET. It was a genuine bug (a dead
 * key name behind a fail-open guard), so it was fixed rather than frozen.
 */
const KNOWN_UNDECLARED: string[] = [
  'AI_DEFAULT_MODEL',
  'AI_DEFAULT_PROVIDER',
  'AI_GATEWAY_BASE_URL',
  'ANTHROPIC_API_KEY',
  'APP_ENV',
  'AUTHOR_HANDOFF_SECRET',
  'BACKDROP_POOL_TARGET',
  'CLAIM_TOKEN_SECRET',
  'COMPARE_REGISTRY_AUDIT_ENABLED',
  'COMPLIANCE_SLACK_WEBHOOK_URL',
  'DATAFORSEO_LOCATION_CODE',
  'DECK_ESTIMATE_BASE_URL',
  'DESIGN_PARTNER_NUDGES_ENABLED',
  'DESIGN_PARTNER_NUDGE_COOLDOWN_HOURS',
  'DESIGN_PARTNER_NUDGE_DUE_SOON_DAYS',
  'DESIGN_PARTNER_NUDGE_STALE_DAYS',
  'DOMAIN_CLAIM_VERIFICATION_ENABLED',
  'EMAIL_SALES',
  'EMAIL_SERVER_HOST',
  'EMAIL_SERVER_PASS',
  'EMAIL_SERVER_PORT',
  'EMAIL_SERVER_USER',
  'EMAIL_SUPPORT',
  'GEO_CLAIM_WINDOW_DAYS',
  'GSC_BASE_URL',
  'GSC_CLIENT_ID',
  'GSC_CLIENT_SECRET',
  'HJ_BACKEND_URL',
  'KEY',
  'LOB_POSTCARD_UNIT_CENTS',
  'LOW_STOCK_ALERTS_ENABLED',
  'MEAL_IMAGES_BUCKET',
  'MENU_DEMAND_CAPTURE_ENABLED',
  'MENU_DEMAND_CAPTURE_SMS',
  'MENU_DEMAND_NOTIFY_THRESHOLD',
  'MENU_DRAFT_INDEXABLE',
  'NAMECHEAP_API_URL',
  'NAMECHEAP_USERNAME',
  'NEXT_PUBLIC_AI_MODEL',
  'NEXT_PUBLIC_AI_PROVIDER',
  'NEXT_PUBLIC_APP_BASE_URL',
  'NEXT_PUBLIC_AUTH_REDIRECT_URL',
  'NEXT_PUBLIC_BASE_DOMAIN',
  'NEXT_PUBLIC_DEBUG_AUTH',
  'NEXT_PUBLIC_GOOGLE_AUTH_ENABLED',
  'NEXT_PUBLIC_IN_YOUR_VOICE_EMBED_ID',
  'NEXT_PUBLIC_LOGIN_LOGO_DARK_URL',
  'NEXT_PUBLIC_ORG_SLUG',
  'NEXT_PUBLIC_REALTORS_DEMO_EMBED_ID',
  'NEXT_PUBLIC_RECAPTCHA_SITE_KEY',
  'NEXT_PUBLIC_SECONDSET_NARRATION_EMBED_ID',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPPORT_EMAIL',
  'NEXT_PUBLIC_TALKING_DEMO_EMBED_ID',
  'NEXT_PUBLIC_TEMPLATES_TABLE',
  'NEXT_PUBLIC_THUMIO_API_KEY',
  'NEXT_PUBLIC_WHATS_NEW_SMOKE_EMBED_ID',
  'OPENAI_IMAGE_MODEL',
  'OPENAI_MODEL',
  'OPENCAGE_KEY',
  'OPS_EMAILS',
  'OUTREACH_DEFAULT_ORG_SLUG',
  'PARKS_REGISTRY_ENABLED',
  'PARTNER_PAYOUTS_CRON_ENABLED',
  'POSTCARD_LOCAL_RADIUS_MILES',
  'POSTCARD_SENDER_CITY',
  'POSTCARD_SENDER_EMAIL',
  'POSTCARD_SENDER_HEADSHOT_URL',
  'POSTCARD_SENDER_LAT',
  'POSTCARD_SENDER_LNG',
  'POSTCARD_SENDER_NAME',
  'POSTCARD_SENDER_SIGNATURE_URL',
  'POSTCARD_SENDER_STATE',
  'POSTCARD_SENDER_TITLE',
  'PUBLIC_APP_URL',
  'PUBLIC_BASE_URL',
  'QSITES_DEBUG',
  'QS_AFFILIATE_FEE_SHARE',
  'QS_AFFILIATE_MAX_FEE_SHARE',
  'QS_DEFAULT_PLATFORM_FEE_MIN_CENTS',
  'QS_DOMAIN_TXT_TOKEN',
  'QS_MIN_NET_KEEP_CENTS',
  'QS_POD_SHIPPING_CENTS',
  'QS_RESTAURANT_PLATFORM_FEE_MIN_CENTS',
  'QS_RESTAURANT_PLATFORM_FEE_PERCENT',
  'QS_RESTOCK_ON_REFUND',
  'QS_SHIPPING_BASE_CENTS',
  'QS_SHIPPING_CENTS_PER_KG',
  'QS_STRIPE_FIXED_CENTS',
  'QS_STRIPE_ON_BEHALF_OF',
  'QS_STRIPE_PCT',
  'REALTY_IDX_ENABLED',
  'REBUILD_HERO_ENABLED',
  'REPORT_RECIPIENT_EMAIL',
  'RESEND_WEBHOOK_SECRET',
  'SECONDSET_ENABLED',
  'SEED_CHEFS_TABLE',
  'SEED_MERCHANTS_TABLE',
  'SEED_PRODUCTS_TABLE',
  'SEED_PURGE_BUCKETS',
  'SEED_PURGE_EXTRA_PREFIXES',
  'SEED_TEMPLATES_TABLE',
  'SIGNUP_NOTIFY_EMAILS',
  'SITE_PREVIEW_TOKEN',
  'SQUARE_ACCESS_TOKEN',
  'TALKING_DEMO_AUTOGEN_ENABLED',
  'VERCEL_DEPLOYMENT_ID',
  'VERCEL_PROJECT_NAME',
  'X',
];

describe('rule 7a — every env key the source reads is declared or explicitly excused', () => {
  const read = envKeysReadBySource();
  const declared = new Set([...declaredInEnvExample(), ...declaredInGates()]);

  it('scans a non-trivial amount of source (guards against a broken walker)', () => {
    // If the walker silently returned nothing, every assertion below would vacuously pass —
    // which is exactly the kind of green-but-meaningless check this rule exists to prevent.
    expect(read.size).toBeGreaterThan(50);
  });

  it('has a written reason for every intentionally-unchecked key', () => {
    for (const [key, reason] of Object.entries(INTENTIONALLY_UNCHECKED)) {
      expect(typeof reason).toBe('string');
      // Reject placeholders like "As above." / "Has a default." — the failure mode PH hit.
      expect(reason.trim().length).toBeGreaterThan(25);
      expect(reason).toMatch(/\s/);
      expect(reason.toLowerCase()).not.toMatch(/^as above|^has a default|^n\/?a\b|^todo/);
      expect(key).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
    }
  });

  it('declares every env key the request-serving source reads', () => {
    const undeclared = [...read]
      .filter((k) => !declared.has(k))
      .filter((k) => !(k in INTENTIONALLY_UNCHECKED))
      .filter((k) => !KNOWN_UNDECLARED.includes(k))
      .sort();

    // The message is the product here: a bare count tells the next person nothing.
    const detail = undeclared.length
      ? `\n\n${undeclared.length} env key(s) are read by app/lib/components but declared nowhere:\n` +
        undeclared.map((k) => `  • ${k}`).join('\n') +
        `\n\nFix one of three ways:\n` +
        `  1. add it to .env.example (it's real config someone must set), or\n` +
        `  2. add it to a gate in lib/config/health.ts (a feature depends on it), or\n` +
        `  3. add it to INTENTIONALLY_UNCHECKED with a real reason (it's platform-injected).\n\n` +
        `This is the check that caught RECAPTCHA_SECRET vs RECAPTCHA_SECRET_KEY.`
      : '';
    // Jest has no message argument on expect(), so the detail becomes the compared value —
    // a failure then prints the full actionable list rather than "[] !== [...]".
    expect(undeclared.length === 0 ? 'no undeclared env keys' : detail).toBe('no undeclared env keys');
  });

  it('every gate-required key is actually read by the source', () => {
    // The inverse direction — PH's false-CRITICAL case, where STRIPE_WEBHOOK_SECRET was
    // declared for a service that never read it. A gate on a key nothing reads is a check
    // that will cry wolf on a correctly-configured deploy, which trains people to ignore it.
    const unread = [...declaredInGates()].filter((k) => !read.has(k)).sort();
    expect(
      unread.length === 0
        ? 'every gate key is read'
        : `gate keys nothing reads (each will cry wolf on a correct deploy): ${unread.join(', ')}`,
    ).toBe('every gate key is read');
  });

  it('the debt baseline only ever shrinks', () => {
    // If a baselined key has since been declared, it must be REMOVED from the list. Without
    // this the baseline rots into a permanent allowlist and the check quietly stops meaning
    // anything — the same "green but meaningless" failure mode rule 7a exists to prevent.
    const nowDeclared = KNOWN_UNDECLARED.filter((k) => declared.has(k) || k in INTENTIONALLY_UNCHECKED).sort();
    expect(
      nowDeclared.length === 0
        ? 'baseline is minimal'
        : `these keys are now declared — delete them from KNOWN_UNDECLARED: ${nowDeclared.join(', ')}`,
    ).toBe('baseline is minimal');
  });

  it('no longer contains RECAPTCHA_SECRET (it was a real bug, fixed not frozen)', () => {
    expect(KNOWN_UNDECLARED).not.toContain('RECAPTCHA_SECRET');
    expect(read.has('RECAPTCHA_SECRET')).toBe(false);
  });
});
