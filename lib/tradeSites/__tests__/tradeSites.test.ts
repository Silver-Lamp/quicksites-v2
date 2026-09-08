/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  tradeSiteDomainPriceCents,
  tradeSiteMaxDomainPriceUsd,
  tradeSiteBillingEnabled,
  isTradeIndustry,
  normalizeApexDomain,
  tradeSiteRefFromMetadata,
  TRADE_SITE_META_TEMPLATE,
  TRADE_SITE_META_DOMAIN,
} from '@/lib/tradeSites/config';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('config — the price is a proposal that lives in env, never in copy', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults to $19/month and floors at $1 so a typo cannot sell for free', () => {
    delete process.env.TRADE_SITE_DOMAIN_PRICE_CENTS;
    expect(tradeSiteDomainPriceCents()).toBe(1900);
    process.env.TRADE_SITE_DOMAIN_PRICE_CENTS = '2900';
    expect(tradeSiteDomainPriceCents()).toBe(2900);
    process.env.TRADE_SITE_DOMAIN_PRICE_CENTS = '0';
    expect(tradeSiteDomainPriceCents()).toBe(1900);
    process.env.TRADE_SITE_DOMAIN_PRICE_CENTS = 'nineteen';
    expect(tradeSiteDomainPriceCents()).toBe(1900);
  });

  it('the domain price ceiling defaults to $25/yr — a $200 premium name loses money at $19/mo', () => {
    delete process.env.TRADE_SITE_MAX_DOMAIN_PRICE_USD;
    expect(tradeSiteMaxDomainPriceUsd()).toBe(25);
  });

  it('billing is OFF unless the flag says 1 or true', () => {
    delete process.env.TRADE_SITE_BILLING_ENABLED;
    expect(tradeSiteBillingEnabled()).toBe(false);
    process.env.TRADE_SITE_BILLING_ENABLED = '1';
    expect(tradeSiteBillingEnabled()).toBe(true);
  });
});

describe('what counts as a trade', () => {
  it.each(['towing', 'plumbing', 'hvac', 'auto_repair', 'electrical', 'concrete', 'roofing'])('%s is a trade', (k) => {
    expect(isTradeIndustry(k)).toBe(true);
  });
  it.each(['restaurant', 'personal', 'author', 'faith', null, undefined, ''])('%s is not', (k) => {
    expect(isTradeIndustry(k as any)).toBe(false);
  });
});

describe('domain normalisation', () => {
  it.each([
    ['smithtowing.com', 'smithtowing.com'],
    ['https://www.SmithTowing.com/', 'smithtowing.com'],
    ['smith-towing.co', 'smith-towing.co'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeApexDomain(input)).toBe(expected);
  });
  it.each(['', 'not a domain', 'shop.smithtowing.com', '-bad.com', 'x.c', 'smithtowing'])('rejects %s', (input) => {
    expect(normalizeApexDomain(input)).toBeNull();
  });
});

describe('webhook routing — the metadata decides which rail', () => {
  it('a trade-site session is recognised by its template id', () => {
    expect(tradeSiteRefFromMetadata({ [TRADE_SITE_META_TEMPLATE]: 'tpl-1', [TRADE_SITE_META_DOMAIN]: 'a.com' })).toEqual({ templateId: 'tpl-1', domain: 'a.com' });
  });
  it('a geo rental is never mistaken for one', () => {
    expect(tradeSiteRefFromMetadata({ geo_campaign_id: 'c-1' })).toBeNull();
    expect(tradeSiteRefFromMetadata(null)).toBeNull();
  });
});

// ── Source guards: these are properties of the wiring, and TypeScript cannot see them ─────────
describe('the wiring that makes the loop close', () => {
  it('claiming a draft publishes it — the claim used to make the site vanish', () => {
    const src = read('lib/auth/claimPendingSiteDraft.ts');
    expect(src).toMatch(/activateClaimedSite\(/);
    // Only on a successful transfer, never on a leaked/replayed link.
    expect(src).toMatch(/transferred === true/);
  });

  it('activation publishes through the sanctioned RPC and records the claim on the prospect', () => {
    const src = read('lib/tradeSites/activate.ts');
    expect(src).toMatch(/rpc\('publish_template'/);
    expect(src).toMatch(/status: 'claimed'/);
    expect(src).not.toMatch(/\.from\('templates'\)\s*\.update\(/); // guard-blocked, and the RPC does it
  });

  it('the geo webhook routes all three event kinds to the trade rail', () => {
    const src = read('app/api/stripe/geo-webhook/route.ts');
    expect(src).toMatch(/applyTradeSiteCheckoutCompleted\(/);
    expect(src).toMatch(/applyTradeSiteSubscriptionStatus\(/);
    expect(src).toMatch(/applyTradeSiteInvoicePaid\(/);
  });

  it('the checkout is owner-gated, flag-gated and price-checked before Stripe', () => {
    const src = read('app/api/trade-sites/checkout/route.ts');
    expect(src).toMatch(/requireTemplateOwner\(/);
    expect(src).toMatch(/tradeSiteBillingEnabled\(\)/);
    expect(src).toMatch(/checkAvailability\(/);
    expect(src).toMatch(/tradeSiteMaxDomainPriceUsd\(\)/);
  });

  it('no surface hardcodes the price — it is read from config everywhere', () => {
    for (const p of ['app/welcome/[id]/page.tsx', 'components/welcome/trade-site-upgrade.tsx', 'app/api/trade-sites/checkout/route.ts']) {
      expect(read(p)).not.toMatch(/\$\s?19\b|1900(?!\))/);
    }
    expect(read('app/welcome/[id]/page.tsx')).toMatch(/tradeSiteDomainPriceCents\(\)/);
  });

  it('binding a domain writes the legacy sites row a custom host is served from', () => {
    // app/host resolves ONLY via sites.domain; a template-only write leaves the domain 404ing.
    const src = read('lib/tradeSites/subscriptions.ts');
    expect(src).toMatch(/from\('sites'\)/);
    expect(src).toMatch(/published_snapshot_id/);
    expect(src).toMatch(/rpc\('set_template_custom_domain'/);
  });

  it('every new env key is declared', () => {
    const env = read('.env.example');
    for (const k of ['TRADE_SITE_BILLING_ENABLED', 'TRADE_SITE_DOMAIN_PRICE_CENTS', 'TRADE_SITE_MAX_DOMAIN_PRICE_USD']) {
      expect(env).toMatch(new RegExp(`^${k}=`, 'm'));
    }
  });
});
