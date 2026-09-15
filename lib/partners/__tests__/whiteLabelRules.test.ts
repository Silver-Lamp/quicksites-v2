/**
 * @jest-environment node
 */
// lib/partners/__tests__/whiteLabelRules.test.ts
//
// The pure half of partner self-serve white-label activation, plus two source guards for the
// halves a unit test cannot see: middleware must consult org_domains (or a partner's portal host
// falls through to the custom-domain rewrite and 404s), and the partner routes must never take
// an org id from the client.
import fs from 'node:fs';
import path from 'node:path';
import {
  dnsInstructionsFor,
  emailFromFor,
  isApexHost,
  isReservedHost,
  normalizeHost,
  orgSlugFromName,
  whiteLabelSteps,
  type WhiteLabelState,
} from '@/lib/partners/whiteLabelRules';

describe('normalizeHost', () => {
  it('strips scheme, path, port and case', () => {
    expect(normalizeHost(' https://App.YourBrand.com/login ')).toBe('app.yourbrand.com');
    expect(normalizeHost('app.yourbrand.com:443')).toBe('app.yourbrand.com');
    expect(normalizeHost('yourbrand.com.')).toBe('yourbrand.com');
  });
  it('rejects non-hosts', () => {
    for (const bad of ['', 'localhost', 'not a host', 'a..b', 42, null, undefined, '-bad.com']) {
      expect(normalizeHost(bad)).toBeNull();
    }
  });
});

describe('isReservedHost', () => {
  it('refuses our own domains, the menu surface and previews', () => {
    for (const h of ['app.quicksites.ai', 'quicksites.ai', 'x.delivered.menu', 'foo.vercel.app', 'cedarsites.com', 'a.b.pointsevenstudio.com']) {
      expect(isReservedHost(h)).toBe(true);
    }
  });
  it('allows a partner-owned host', () => {
    expect(isReservedHost('app.adzemedia.com')).toBe(false);
    expect(isReservedHost('quicksites.ai.example.com')).toBe(false);
  });
});

describe('dnsInstructionsFor', () => {
  it('gives a subdomain a CNAME and an apex an A record', () => {
    expect(isApexHost('yourbrand.com')).toBe(true);
    expect(dnsInstructionsFor('app.yourbrand.com')).toEqual([{ type: 'CNAME', name: 'app', value: 'cname.vercel-dns.com' }]);
    expect(dnsInstructionsFor('portal.eu.yourbrand.com')).toEqual([{ type: 'CNAME', name: 'portal.eu', value: 'cname.vercel-dns.com' }]);
    expect(dnsInstructionsFor('yourbrand.com')).toEqual([{ type: 'A', name: '@', value: '76.76.21.21' }]);
  });
});

describe('orgSlugFromName', () => {
  it('shapes a slug and keeps reserved words from shadowing routes', () => {
    expect(orgSlugFromName('Adze Media')).toBe('adze-media');
    expect(orgSlugFromName('  Ünïcode & Co. ')).toBe('unicode-co');
    expect(orgSlugFromName('Admin')).toBe('admin-brand');
    expect(orgSlugFromName('Ab')).toBe('brand-ab');
    expect(orgSlugFromName('Adze Media', 'x9k2')).toBe('adze-media-x9k2');
    expect(orgSlugFromName('a'.repeat(80)).length).toBeLessThanOrEqual(40);
  });
});

describe('emailFromFor', () => {
  it('builds a display-name sender on the verified domain', () => {
    expect(emailFromFor('Adze Media', 'AdzeMedia.com')).toBe('Adze Media <hello@adzemedia.com>');
    expect(emailFromFor('<script>', 'x.com')).toBe('script <hello@x.com>');
  });
});

describe('whiteLabelSteps', () => {
  const base: WhiteLabelState = { org: null, domain: null, email: null, payoutsActive: false, code: 'lyz186814444', platformBase: 'https://www.quicksites.ai' };

  it('starts everything at todo with a platform share link', () => {
    const steps = whiteLabelSteps(base);
    expect(steps.map((s) => s.status)).toEqual(['todo', 'todo', 'todo', 'todo', 'todo']);
    expect(steps[4].detail).toContain('https://www.quicksites.ai/join/lyz186814444');
  });

  it('reports pending, not done, while DNS is on the partner', () => {
    const steps = whiteLabelSteps({
      ...base,
      org: { slug: 'adze-media', name: 'Adze Media', support_email: 'hello@adzemedia.com', logo_url: 'https://x/l.webp', dark_logo_url: null },
      domain: { host: 'app.adzemedia.com', verified_at: null },
      email: { domain: 'adzemedia.com', status: 'pending' },
    });
    expect(steps.find((s) => s.key === 'brand')!.status).toBe('done');
    expect(steps.find((s) => s.key === 'domain')!.status).toBe('pending');
    expect(steps.find((s) => s.key === 'email')!.status).toBe('pending');
    // The share link stays on the platform host until the domain verifies.
    expect(steps.find((s) => s.key === 'share')!.detail).toContain('quicksites.ai/join/');
  });

  it('moves the share link to the partner host once verified', () => {
    const steps = whiteLabelSteps({
      ...base,
      org: { slug: 'adze-media', name: 'Adze Media', support_email: 'hello@adzemedia.com', logo_url: 'https://x/l.webp', dark_logo_url: null },
      domain: { host: 'app.adzemedia.com', verified_at: '2026-09-15T00:00:00Z' },
      email: { domain: 'adzemedia.com', status: 'verified' },
      payoutsActive: true,
    });
    expect(steps.map((s) => s.status)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(steps[4].detail).toContain('https://app.adzemedia.com/join/lyz186814444');
  });

  it('a brand with no logo or support email is pending, not done', () => {
    const steps = whiteLabelSteps({ ...base, org: { slug: 'x', name: 'X', support_email: null, logo_url: null, dark_logo_url: null } });
    expect(steps[0].status).toBe('pending');
  });
});

describe('source guards', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

  it('middleware consults org_domains for unknown hosts', () => {
    const src = read('middleware.ts');
    expect(src).toMatch(/org_domains_public\?host=eq\./);
    expect(src).toMatch(/kind === 'admin'/);
  });

  it('partner brand routes scope through the signed-in partner, never a client org id', () => {
    for (const f of ['app/api/partners/brand/route.ts', 'app/api/partners/brand/domain/route.ts', 'app/api/partners/brand/email-domain/route.ts', 'app/api/partners/brand/logo/route.ts']) {
      const src = read(f);
      expect(src).toMatch(/requirePartner\(\)/);
      expect(src).not.toMatch(/body\??\.org_?[iI]d|params\.(id|orgId)/);
    }
  });
});
