/** @jest-environment node */
// lib/lemonade/__tests__/lemonadeStand.test.ts
//
// node env, not jsdom: buildIndustryStarter mints ids via crypto.randomUUID, which jsdom
// does not provide. Same reason industryScaffold.test.ts pins the environment.
import { standUrlFor, renderStandSignHtml } from '@/lib/lemonade/standSign';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { resolveIndustryKey, KEY_TO_LABEL } from '@/lib/industries';

describe('standUrlFor', () => {
  it('prefers a custom domain, and normalises what people paste into that field', () => {
    expect(standUrlFor({ slug: 'ellies', custom_domain: 'ellieslemonade.com' })).toBe('https://ellieslemonade.com');
    expect(standUrlFor({ slug: 'ellies', custom_domain: 'https://ellieslemonade.com/' })).toBe('https://ellieslemonade.com');
  });

  it('falls back to the platform subdomain', () => {
    expect(standUrlFor({ slug: 'ellies-stand' })).toBe('https://ellies-stand.quicksites.ai');
  });

  it('returns null rather than a broken URL when there is no address', () => {
    // ⚠️ The caller prints this into a QR code and tapes it to a table. A string like
    // "https://undefined.quicksites.ai" would scan perfectly and go nowhere, and nobody
    // would find out until a customer tried to pay.
    expect(standUrlFor({ slug: '', custom_domain: '' })).toBeNull();
    expect(standUrlFor({})).toBeNull();
  });
});

describe('the printed sign', () => {
  // Rendering is ~170ms in a real process; the default 5s budget is spent on jest's first
  // transform of the qrcode package, not on the work under test.
  jest.setTimeout(30_000);

  const model = { standUrl: 'https://ellies-stand.quicksites.ai', standName: "Ellie's Stand" };

  it('prints the address in text as well as in the QR', async () => {
    // A QR-only sign fails exactly the customer it exists for: the one whose camera won't scan.
    const html = await renderStandSignHtml(model);
    expect(html).toContain('ellies-stand.quicksites.ai');
    // ⚠️ The property this protects is INLINED, not PNG. The sheet must carry its images in the
    // document so it prints from a library computer with no network — the format is incidental,
    // and pinning it broke this test when the QRs became SVG (vector: crisp at any print size,
    // and ~20s→~0s to render). Assert the thing that matters.
    expect(html).toMatch(/src="data:image\/(png;base64|svg\+xml)/);
  });

  it('is self-contained — no external assets to fail on a library printer', async () => {
    const html = await renderStandSignHtml(model);
    expect(html).not.toMatch(/<(script|link)\b/i);
    expect(html).not.toMatch(/src="https?:\/\//i);
  });

  it('omits the cause line entirely when there is no cause, rather than inventing one', async () => {
    const without = await renderStandSignHtml(model);
    // Assert on the rendered ELEMENT, not the class name — the stylesheet always defines
    // .sign-cause, so `not.toContain('sign-cause')` was testing the CSS, not the output.
    expect(without).not.toContain('<div class="sign-cause">');
    const with_ = await renderStandSignHtml({ ...model, cause: 'Saving up for a bike' });
    expect(with_).toContain('Saving up for a bike');
  });

  it('escapes the stand name', async () => {
    const html = await renderStandSignHtml({ ...model, standName: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('the lemonade_stand industry', () => {
  it('is a real registry entry, so it shows up everywhere industries are listed', () => {
    expect(KEY_TO_LABEL['lemonade_stand']).toBe('Lemonade Stand');
  });

  it('matches "lemonade" before anything else claims it', () => {
    expect(resolveIndustryKey('lemonade stand')).toBe('lemonade_stand');
    expect(resolveIndustryKey("Ellie's Lemonade")).toBe('lemonade_stand');
    // Still a restaurant, not a stand.
    expect(resolveIndustryKey('Italian restaurant')).toBe('restaurant');
  });
});

describe('the lemonade_stand scaffold', () => {
  const built: any = buildIndustryStarter({ businessName: "Ellie's Stand", industryKey: 'lemonade_stand' });
  const blocks: any[] = built?.data?.pages?.[0]?.blocks ?? built?.data?.pages?.[0]?.content_blocks ?? [];
  const types = blocks.map((b) => b?.type);

  it('leads with a menu and a way to order', () => {
    expect(types).toContain('menu');
    expect(types).toContain('order_bar');
    expect(types[0]).toBe('hero');
  });

  it('has no contact form — a stand does not need an inbox', () => {
    // Not a style preference: a form on a child's page inviting strangers to send messages
    // is a feature with no upside in this vertical.
    expect(types).not.toContain('contact_form');
  });

  it('has no location block — the restaurant scaffold would have added one', () => {
    // The address here is a family's home. The whole reason lemonade_stand is not in
    // FOOD_INDUSTRIES is to avoid inheriting a map to it.
    expect(types).not.toContain('location');
    expect(types).not.toContain('hours');
  });

  it('seeds a real menu the grown-up can just edit prices on', () => {
    const menu = blocks.find((b) => b?.type === 'menu');
    const items = (menu?.content?.sections ?? []).flatMap((s: any) => s.items ?? []);
    expect(items.length).toBeGreaterThan(2);
    expect(items.every((i: any) => i.name && i.price)).toBe(true);
  });

  it('gives the stand a free CSS backdrop, not a paid painterly one', () => {
    // A site that might exist for one Saturday must not trigger image spend on creation.
    expect(built?.data?.meta?.backdrop?.style).toBe('aurora');
    expect(built?.data?.meta?.backdrop?.url ?? null).toBeNull();
  });
});
