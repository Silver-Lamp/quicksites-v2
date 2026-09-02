// lib/config/health.ts
//
// Rule 7 of the mesh config standard (crosstalk/contracts/config-registry.md, ADOPTED
// 2026-07-27): **fail loud at startup when a feature's required config is incomplete.**
//
// Why this exists, concretely. In a single day this repo produced six instances of
// "merged, looked correct, silently wasn't", every one of them a config gap that no test,
// no typecheck and no code review would have caught:
//
//   • partner audio sat inert for five days with 1 of 3 required vars set
//   • /api/subscribe's captcha was disabled because the code read RECAPTCHA_SECRET while
//     the env is named RECAPTCHA_SECRET_KEY — a guard that returned true and said nothing
//   • .env.example told new developers to set SUPABASE_SECRETlo_KEY, which nothing reads
//   • delivered.menu routing stayed dormant because a NEXT_PUBLIC_ var needs a REBUILD,
//     not just a value
//
// None were found by reading code. They were found by running something and looking. This
// module is the cheap version of "looking", run automatically at every boot.
//
// ── Design rules, taken from HJ's shipped config-health (the reference impl) ─────────────
//  1. **Report presence, never values.** A gate says a key is set or unset. It must be safe
//     to log and safe to serve, so the check itself can never leak a secret.
//  2. **Never halt boot.** A boot loop is a worse outage than the thing being reported.
//  3. **Say what actually breaks, in prose readable at 3am.** A boot log nobody can act on
//     is just a quieter silence — this is the field that turns a warning into a fix.
//  4. `degradeOnly` separates "this feature is off" from "this feature is broken". An
//     enabled-but-incomplete gate is the loud case; a deliberately-off one is not a problem.

export type GateStatus = 'ready' | 'off' | 'incomplete';

export type ConfigGate = {
  /** Stable slug — appears in /status and in logs. */
  key: string;
  label: string;
  /** Env var that turns the feature on. Absent ⇒ the feature is always-on infrastructure. */
  enabledBy?: string;
  /** Values of `enabledBy` that count as ON. Default: '1' | 'true' (case-insensitive). */
  enabledWhen?: (raw: string | undefined) => boolean;
  /**
   * Keys that MUST be set for the feature to actually work.
   *
   * ⚠️ NEVER list a key that has a code default (`process.env.X || 'fallback'`). The feature
   * works without it, so the gate would report `incomplete` on a correctly-configured
   * deploy — a false CRITICAL. A check that cries wolf trains people to ignore it, which is
   * worse than no check at all. This exact mistake shipped here on the first production run
   * (NEXT_PUBLIC_HEAR_THIS_PAGE_EMBED_ID, which falls back to the house embed), and it's the
   * same failure PorchHearth hit with a STRIPE_WEBHOOK_SECRET declared for a service that
   * never read it. Rule 7a's inverse check cannot catch this one — the key IS read, just
   * with a fallback — so it needs a human eye at declaration time.
   */
  requires: string[];
  /** Any-of groups: at least one key in each group must be set (aliases, fallbacks). */
  requiresAnyOf?: string[][];
  /**
   * What breaks, in plain language. Rule 3 above — this is the difference between a log
   * line someone acts on and one they scroll past.
   */
  breaks: string;
  /** True when an incomplete gate degrades gracefully rather than erroring. */
  degradeOnly?: boolean;
};

const on = (raw: string | undefined) => raw === '1' || String(raw).toLowerCase() === 'true';
const set = (k: string) => !!(process.env[k] && String(process.env[k]).trim());

/**
 * Every feature in this repo whose behaviour depends on config being complete.
 *
 * Adding a feature that reads env? Add a gate. The rule-7a test
 * (lib/config/__tests__/declarations.test.ts) enforces that every env key the source reads
 * is either declared here, in .env.example, or explicitly excused with a written reason —
 * so a key can't quietly go un-checked the way RECAPTCHA_SECRET did.
 */
export const CONFIG_GATES: ConfigGate[] = [
  {
    key: 'supabase',
    label: 'Supabase (database + auth)',
    requires: ['NEXT_PUBLIC_SUPABASE_URL'],
    requiresAnyOf: [
      ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'],
      ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
    ],
    breaks: 'Nothing works. Every page and API route that touches data fails with "supabaseUrl is required".',
  },
  {
    key: 'commerce',
    label: 'Commerce (Stripe checkout + webhooks)',
    requires: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    breaks:
      'Checkout cannot create a Stripe session, and without the webhook secret paid orders are never marked paid — money is taken and the order sits unfulfilled.',
  },
  {
    key: 'geo_rentals',
    label: 'Geo-domain rental subscriptions (recurring revenue)',
    requires: ['STRIPE_SECRET_KEY', 'STRIPE_GEO_WEBHOOK_SECRET'],
    breaks:
      'A renter completes Stripe checkout and is charged every month, but nothing is written back: the campaign still reads unrented, no subscription id is stored, and renewals and failed payments are invisible. The money moves and our records do not. This gate exists because that was the live state — commerce showed "ready" while the rental webhook answered "not configured", and the one money path that had never taken a payment was the one path no gate watched.',
  },
  {
    key: 'ai',
    label: 'AI (copy, hero images, backdrops)',
    requires: ['OPENAI_API_KEY'],
    degradeOnly: true,
    breaks:
      'AI copy/image generation returns nothing. Site builds still work but fall back to placeholder copy and no hero image.',
  },
  {
    key: 'email',
    label: 'Transactional email (Resend)',
    requires: ['RESEND_API_KEY'],
    breaks:
      'No transactional email leaves the app — order receipts, claim links, campaign sends and admin alerts all silently do not arrive.',
  },
  {
    key: 'sms',
    label: 'SMS (Twilio)',
    requires: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    requiresAnyOf: [['TWILIO_FROM', 'TWILIO_PHONE_NUMBER']],
    degradeOnly: true,
    breaks:
      'Outreach texts and claim-verification codes are not sent. Flows that depend on an SMS code cannot complete.',
  },
  {
    key: 'postcard_mail',
    label: 'Physical mail (Lob postcards)',
    // Only meaningful when someone has switched it on — the pipeline is off by default because
    // every piece costs real money.
    enabledBy: 'POSTCARD_MAIL_ENABLED',
    requires: ['LOB_API_KEY', 'LOB_FROM_NAME', 'LOB_FROM_LINE1', 'LOB_FROM_CITY', 'LOB_FROM_STATE', 'LOB_FROM_ZIP'],
    breaks:
      'Postcards are not mailed. The send route fails closed with a 501, so nothing is charged and nothing is printed — but an operator who thinks a batch went out will be wrong, and prospects are marked as contacted by a separate code path.',
  },
  {
    key: 'cron',
    label: 'Scheduled jobs',
    requires: ['CRON_SECRET'],
    breaks:
      'Cron endpoints reject Vercel\'s scheduler, so nightly work stops: payouts, print-order sync, AI cost alerts, backdrop pool fill.',
  },
  {
    key: 'domains',
    label: 'Domain provisioning (Vercel API)',
    requires: ['VERCEL_TOKEN'],
    degradeOnly: true,
    breaks: 'Buying/attaching customer domains fails with a 500. Existing domains are unaffected.',
  },
  {
    // ⚠️ SEPARATE FROM `domains` ON PURPOSE. Attaching a domain needs only the token, and that is
    // the common case — folding these keys into `domains` would report `incomplete` on every deploy
    // that never intends to buy, which is the false-CRITICAL this file's own comment warns about.
    //
    // But `domains: ready` was ALSO misleading on its own: it answered "can we call Vercel?" while
    // the operator was reading it as "can we buy?". Registration additionally needs a full
    // registrant contact — ICANN requires it — and without it the one-click buy fails at submit,
    // after the price has been shown and the button clicked. Found while pricing
    // <city>-restaurants.com: the gate said ready and nothing in /status could tell me whether a
    // purchase would actually go through.
    key: 'domain_purchase',
    label: 'One-click domain purchase (Vercel registrar)',
    enabledBy: 'VERCEL_DOMAIN_REGISTER_ENABLED',
    requires: ['VERCEL_TOKEN'],
    // Either spelling satisfies each field — NAMECHEAP_* predates the Vercel registrar path and
    // readRegistrantContact() still honours it, so requiring only DOMAIN_* would cry wolf on a
    // working Namecheap-configured deploy.
    requiresAnyOf: [
      ['DOMAIN_REGISTRANT_FIRST', 'NAMECHEAP_REGISTRANT_FIRST'],
      ['DOMAIN_REGISTRANT_LAST', 'NAMECHEAP_REGISTRANT_LAST'],
      ['DOMAIN_REGISTRANT_EMAIL', 'NAMECHEAP_REGISTRANT_EMAIL'],
      ['DOMAIN_REGISTRANT_PHONE', 'NAMECHEAP_REGISTRANT_PHONE'],
      ['DOMAIN_REGISTRANT_ADDRESS', 'NAMECHEAP_REGISTRANT_ADDRESS'],
      ['DOMAIN_REGISTRANT_CITY', 'NAMECHEAP_REGISTRANT_CITY'],
      ['DOMAIN_REGISTRANT_STATE', 'NAMECHEAP_REGISTRANT_STATE'],
      ['DOMAIN_REGISTRANT_ZIP', 'NAMECHEAP_REGISTRANT_ZIP'],
    ],
    degradeOnly: true,
    breaks:
      'The Buy button is shown with a price but the purchase fails at submit — ICANN requires a complete registrant contact. The operator sees a price, clicks, and gets an error.',
  },
  {
    key: 'captcha',
    label: 'Signup/subscribe captcha',
    requires: ['RECAPTCHA_SECRET_KEY'],
    degradeOnly: true,
    breaks:
      'Public form protection is off. /api/subscribe writes to `supporters` unthrottled — this exact gate was silently failing because the code read RECAPTCHA_SECRET and the env is RECAPTCHA_SECRET_KEY.',
  },
  {
    key: 'partner_audio',
    label: 'Partner audio provisioning (HiveJournal)',
    enabledBy: 'PARTNER_AUDIO_PROVISIONING_ENABLED',
    requires: ['PARTNER_QUICKSITES_SECRET', 'PARTNER_GRANT_ENC_KEY'],
    breaks:
      'Owner-voice audio cannot be provisioned. config.ts fails closed, so /merchant/audio looks present but every call is rejected. The shared secret must hold the SAME value in HiveJournal\'s env.',
  },
  {
    key: 'rehearsal_practice',
    label: 'Sales-call rehearsal engine (HiveJournal)',
    enabledBy: 'REHEARSAL_PRACTICE_ENABLED',
    requires: ['PARTNER_QUICKSITES_SECRET', 'HJ_REHEARSAL_GRANT'],
    breaks:
      'Practice turns cannot run. HiveJournal\'s route is partner-grant-only and fails closed on a missing or wrong-scope grant, so the practice surface would render and every turn would 401. The grant must be minted in HiveJournal with scope `rehearsal:practice` — an owner action there, not something a session can issue. The offline call sheet at /for-sales/call is unaffected and needs none of this.',
  },
  {
    key: 'backdrop_pool',
    label: 'Painterly backdrop pool (spends money)',
    enabledBy: 'BACKDROP_POOL_ENABLED',
    requires: ['OPENAI_API_KEY'],
    degradeOnly: true,
    breaks:
      'The nightly pool-fill cron no-ops, so new sites keep their free CSS backdrop instead of a painterly one. Nothing breaks; nothing is spent either.',
  },
  {
    key: 'hero_pool',
    label: 'Painterly hero pool (spends money)',
    enabledBy: 'HERO_POOL_ENABLED',
    requires: ['OPENAI_API_KEY'],
    degradeOnly: true,
    breaks:
      'Painterly heroes are never generated or applied, so lemonade stands and yard sales keep whatever hero their scaffold gave them. Nothing breaks; nothing is spent either. HERO_POOL_TARGET caps how many images an industry may ever generate (default 12, ~$0.04 each).',
  },
  {
    key: 'menu_host',
    label: 'delivered.menu restaurant surface',
    enabledBy: 'NEXT_PUBLIC_MENU_BASE_DOMAIN',
    enabledWhen: (raw) => !!(raw && raw.trim()),
    requires: [],
    degradeOnly: true,
    breaks:
      'delivered.menu traffic is ignored — <slug>.delivered.menu and delivered.menu/<slug> stop resolving to restaurant sites. NOTE: this is a NEXT_PUBLIC_ var, so changing it requires a REBUILD, not just a redeploy of the same build.',
  },
  {
    /**
     * ⚠️ THE APP'S OWN PUBLIC URL. Reads as trivia until something needs to hand an ABSOLUTE
     * url to a third party — then its absence is a 500 at the worst possible moment.
     *
     * Found 2026-08-15: Stripe Connect onboarding built `refresh_url` as `${base}/merchant/...`
     * with `base` falling back to ''. Neither APP_BASE_URL nor QS_PUBLIC_URL was set, so Stripe
     * got a relative URL, rejected it, and the owner saw "Could not start Stripe setup. Please
     * try again" — advice that could never have worked. Roughly eight other call sites build
     * fetch URLs the same way.
     *
     * degradeOnly: the code now defaults to the production host, so an unset value is wrong-ish
     * on previews rather than broken everywhere. It still deserves to be visible.
     */
    key: 'public_base_url',
    label: 'App public base URL (absolute links to third parties)',
    requires: [],
    requiresAnyOf: [['APP_BASE_URL', 'QS_PUBLIC_URL', 'NEXT_PUBLIC_APP_URL']],
    degradeOnly: true,
    breaks:
      'Anything handing an absolute URL to a third party falls back to the production host. On a preview deploy that sends Stripe Connect returns and referral links to production instead of the preview.',
  },
  {
    key: 'yardsale_host',
    label: 'yardsalesites.com garage-sale surface',
    enabledBy: 'NEXT_PUBLIC_YARDSALE_BASE_DOMAIN',
    enabledWhen: (raw) => !!(raw && raw.trim()),
    requires: [],
    degradeOnly: true,
    breaks:
      'yardsalesites.com traffic is ignored — the printed sticker URL falls back to quicksites.ai/s/<code>, which still works. Stickers already handed out keep resolving either way. NOTE: NEXT_PUBLIC_ var, so changing it needs a REBUILD, not just a redeploy.',
  },
  {
    key: 'lemonyum_host',
    label: 'lemonyum.com lemonade-stand surface',
    enabledBy: 'NEXT_PUBLIC_LEMONYUM_BASE_DOMAIN',
    enabledWhen: (raw) => !!(raw && raw.trim()),
    requires: [],
    degradeOnly: true,
    breaks:
      'lemonyum.com traffic is ignored — lemonyum.com/<slug> stops resolving to a stand, and printed signs fall back to <slug>.quicksites.ai. Signs already in the world keep working either way. NOTE: NEXT_PUBLIC_ var, so changing it needs a REBUILD, not just a redeploy.',
  },
  {
    key: 'persona_findings',
    label: 'Persona-testing receiver (HiveJournal)',
    // Keyed on the secret's PRESENCE, requiring nothing else — so it reports `off` when the
    // secret hasn't been issued yet and `ready` once it has, but can never report
    // `incomplete`. Gating it the other way (requires: [SECRET]) would cry wolf on every
    // deploy until the secret exists, which is the hear_this_page mistake repeated.
    enabledBy: 'PERSONA_FINDINGS_SECRET',
    enabledWhen: (raw) => !!(raw && raw.trim()),
    requires: [],
    degradeOnly: true,
    breaks:
      'POST /api/persona-findings returns 503, so HiveJournal cannot file persona test findings. HJ degrades gracefully (logs the report), so nothing breaks on either side — the findings are simply not recorded.',
  },
  {
    key: 'hear_this_page',
    label: 'Hear this page (billed TTS)',
    enabledBy: 'NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED',
    // NOT requiring NEXT_PUBLIC_HEAR_THIS_PAGE_EMBED_ID: lib/hearThisPage/config.ts falls
    // back to the baked-in house embed, so the var is genuinely optional. Requiring it made
    // this gate report `incomplete` on a correctly-configured production deploy — a FALSE
    // CRITICAL on the check's very first live run. See the rule in the ConfigGate docblock:
    // never require a key that has a code default.
    requires: [],
    degradeOnly: true,
    breaks: 'The listen launcher does not render on public pages. No TTS is billed.',
  },
];

export type GateReport = {
  key: string;
  label: string;
  status: GateStatus;
  /** Names of keys that are missing. NEVER included in any public surface (rule: 7b). */
  missing: string[];
  degradeOnly: boolean;
  breaks: string;
};

function gateEnabled(g: ConfigGate): boolean {
  if (!g.enabledBy) return true; // always-on infrastructure
  const raw = process.env[g.enabledBy];
  return g.enabledWhen ? g.enabledWhen(raw) : on(raw);
}

/** Evaluate one gate. Presence only — values are never read into the result. */
export function evaluateGate(g: ConfigGate): GateReport {
  const base = { key: g.key, label: g.label, degradeOnly: !!g.degradeOnly, breaks: g.breaks };
  if (!gateEnabled(g)) return { ...base, status: 'off', missing: [] };

  const missing = g.requires.filter((k) => !set(k));
  for (const group of g.requiresAnyOf ?? []) {
    if (!group.some(set)) missing.push(group.join(' | '));
  }
  return { ...base, status: missing.length ? 'incomplete' : 'ready', missing };
}

export function evaluateAllGates(): GateReport[] {
  return CONFIG_GATES.map(evaluateGate);
}

export type ConfigHealth = {
  ok: boolean;
  ready: number;
  off: number;
  incomplete: number;
  gates: GateReport[];
};

export function configHealth(): ConfigHealth {
  const gates = evaluateAllGates();
  const incomplete = gates.filter((g) => g.status === 'incomplete');
  return {
    // "ok" means nothing is enabled-but-broken. Deliberately-off features are fine.
    ok: incomplete.length === 0,
    ready: gates.filter((g) => g.status === 'ready').length,
    off: gates.filter((g) => g.status === 'off').length,
    incomplete: incomplete.length,
    gates,
  };
}

/**
 * The boot report (rule 7). Loud, actionable, and non-fatal.
 *
 * Returns the lines rather than printing them so the caller decides the sink (console at
 * boot, a durable record, a test assertion) — and so this stays pure and testable.
 */
export function bootReportLines(health: ConfigHealth = configHealth()): string[] {
  if (health.ok) {
    return [`[config] ${health.ready} ready, ${health.off} off, 0 incomplete — all enabled features are fully configured.`];
  }
  const lines: string[] = [
    `[config] ⚠️  ${health.incomplete} feature(s) are ENABLED but INCOMPLETELY CONFIGURED — they will not work:`,
  ];
  for (const g of health.gates.filter((x) => x.status === 'incomplete')) {
    lines.push(`  • ${g.label} (${g.key})${g.degradeOnly ? ' [degrades]' : ' [BROKEN]'}`);
    lines.push(`      missing: ${g.missing.join(', ')}`);
    lines.push(`      what breaks: ${g.breaks}`);
  }
  lines.push(`[config] ${health.ready} ready, ${health.off} off, ${health.incomplete} incomplete.`);
  return lines;
}
