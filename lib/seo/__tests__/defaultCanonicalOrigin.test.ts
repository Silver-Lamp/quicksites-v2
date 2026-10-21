/**
 * @jest-environment node
 */
// lib/seo/__tests__/defaultCanonicalOrigin.test.ts
//
// Once tenant sites live on a tenant root, the platform copy at `www.<brand>/sites/<slug>` must
// stop declaring itself the original: a platform-only site that nominated nothing canonicalises
// to `https://<slug>.<root>`. A nomination still wins, a custom domain still self-references,
// and with no root configured nothing changes (the pre-move rule).
import fs from 'node:fs';
import path from 'node:path';
import { defaultCanonicalOrigin } from '@/lib/seo/canonicalUrl';
import { publicIndexUrl } from '@/lib/seo/indexNow';
import { stripComments } from '@/test/stripComments';

const ENV = 'NEXT_PUBLIC_TENANT_ROOT';
const prev = process.env[ENV];
const setRoot = (v: string | undefined) => {
  if (v === undefined) delete process.env[ENV];
  else process.env[ENV] = v;
};
afterAll(() => setRoot(prev));

describe('defaultCanonicalOrigin', () => {
  it('with no tenant root configured, a site that nominated nothing stays self-referencing', () => {
    setRoot(undefined);
    expect(defaultCanonicalOrigin({ meta: {}, slug: 'sandon', domain: 'sandon.quicksites.ai' })).toBeNull();
    expect(defaultCanonicalOrigin({ meta: {}, slug: 'sandon', domain: null })).toBeNull();
  });

  it('with a tenant root, a platform-only site canonicalises to its host on that root', () => {
    setRoot('qspages.com');
    expect(defaultCanonicalOrigin({ meta: {}, slug: 'sandon', domain: null })).toBe('https://sandon.qspages.com');
    // `published_sites.domain` / `templates.domain` were written as the OLD platform host — not a custom domain.
    expect(defaultCanonicalOrigin({ meta: {}, slug: 'sandon', domain: 'sandon.quicksites.ai' })).toBe('https://sandon.qspages.com');
    expect(defaultCanonicalOrigin({ meta: {}, slug: 'sandon', domain: 'sandon.qspages.com' })).toBe('https://sandon.qspages.com');
    expect(defaultCanonicalOrigin({ meta: null, slug: 'katie-bee-organizing-glfkf' })).toBe('https://katie-bee-organizing-glfkf.qspages.com');
  });

  it('a nomination wins over the rule', () => {
    setRoot('qspages.com');
    expect(defaultCanonicalOrigin({ meta: { canonical_origin: 'https://www.graftontowing.com' }, slug: 'graftontowing', domain: null })).toBe(
      'https://www.graftontowing.com',
    );
  });

  it('a site with a custom domain of its own stays self-referencing (consolidation is a per-site nomination)', () => {
    setRoot('qspages.com');
    expect(defaultCanonicalOrigin({ meta: {}, slug: 'bhard', domain: null, custom_domain: 'bhard.store' })).toBeNull();
    expect(defaultCanonicalOrigin({ meta: {}, slug: 'graftontowing', domain: 'www.graftontowing.com' })).toBeNull();
    // A reseller host is the reseller's own root, not moved by the tenant root.
    expect(defaultCanonicalOrigin({ meta: {}, slug: 'acme', domain: 'acme.cedarsites.com' })).toBeNull();
  });

  it('an empty slug yields nothing rather than a bare root', () => {
    setRoot('qspages.com');
    expect(defaultCanonicalOrigin({ meta: {}, slug: '', domain: null })).toBeNull();
    expect(defaultCanonicalOrigin({ meta: {}, slug: null, domain: null })).toBeNull();
  });
});

describe('publicIndexUrl follows the same bar', () => {
  it('submits the tenant host only once a root is configured', () => {
    setRoot(undefined);
    expect(publicIndexUrl({ slug: 'my-site', claim_source: 'guest_build' })).toBeNull();
    setRoot('qspages.com');
    expect(publicIndexUrl({ slug: 'my-site', claim_source: 'guest_build' })).toBe('https://my-site.qspages.com');
    expect(publicIndexUrl({ slug: 'my-site', custom_domain: 'my-site.com' })).toBe('https://my-site.com');
  });
});

describe('the platform route uses the rule', () => {
  it('builds its canonical origin from defaultCanonicalOrigin with the row fields', () => {
    const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'app/sites/[slug]/[[...rest]]/page.tsx'), 'utf8'));
    expect(src).toMatch(/const canonicalOrigin = defaultCanonicalOrigin\(\{/);
    expect(src).toMatch(/custom_domain: siteRow\.custom_domain \?\? null/);
    expect(src).not.toMatch(/const canonicalOrigin = canonicalOriginFromMeta\(/);
    // The loader must fetch the column the rule reads, or every custom-domain site reads as platform-only.
    expect(src).toMatch(/\.select\('id, slug, data, domain, custom_domain'\)/);
  });
});
