/**
 * @jest-environment node
 */
// lib/sites/__tests__/tenantRoot.test.ts — the tenant root is ONE module, and nothing else
// spells a tenant host from the brand root. The source guard is the point: a grep that misses
// one file ships one surface still printing `<slug>.quicksites.ai` after the move.
import fs from 'node:fs';
import path from 'node:path';
import {
  BRAND_ROOT,
  isBrandHost,
  isTenantRootApex,
  legacyTenantRedirectHost,
  platformSiteRoots,
  siteSlugFromHost,
  tenantRoot,
  tenantRootConfigured,
  tenantSiteDomains,
  tenantSiteHost,
  tenantSiteHosts,
  tenantSiteUrl,
} from '@/lib/sites/tenantRoot';

const ENV = 'NEXT_PUBLIC_TENANT_ROOT';
const withRoot = (v: string | undefined, fn: () => void) => {
  const prev = process.env[ENV];
  if (v === undefined) delete process.env[ENV];
  else process.env[ENV] = v;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env[ENV];
    else process.env[ENV] = prev;
  }
};

describe('tenantRoot — unset (today)', () => {
  it('is the brand root, nothing redirects, hosts build on quicksites.ai', () => {
    withRoot(undefined, () => {
      expect(tenantRoot()).toBe(BRAND_ROOT);
      expect(tenantRootConfigured()).toBe(false);
      expect(tenantSiteHost('sandon')).toBe('sandon.quicksites.ai');
      expect(tenantSiteUrl('Sandon ')).toBe('https://sandon.quicksites.ai');
      expect(tenantSiteHost('')).toBe('');
      expect(tenantSiteUrl(null)).toBe('');
      expect(tenantSiteHosts('x')).toEqual(['x.quicksites.ai']);
      expect(platformSiteRoots()).toEqual(['quicksites.ai']);
      expect(tenantSiteDomains()).toEqual(['quicksites.ai', 'cedarsites.com', 'pointsevenstudio.com']);
      expect(legacyTenantRedirectHost('sandon.quicksites.ai')).toBeNull();
      expect(isTenantRootApex('quicksites.ai')).toBe(false);
    });
  });
  it('a value equal to the brand root, or without a dot, counts as unset', () => {
    withRoot('quicksites.ai', () => expect(tenantRootConfigured()).toBe(false));
    withRoot('https://QuickSites.ai/', () => expect(tenantRootConfigured()).toBe(false));
    withRoot('localhost', () => expect(tenantRootConfigured()).toBe(false));
    withRoot('   ', () => expect(tenantRootConfigured()).toBe(false));
  });
});

describe('tenantRoot — configured', () => {
  it('builds on the new root; the brand host stays a LOOKUP alias, never a link', () => {
    withRoot('https://QSiteHost.com.', () => {
      expect(tenantRoot()).toBe('qsitehost.com');
      expect(tenantRootConfigured()).toBe(true);
      expect(tenantSiteHost('sandon')).toBe('sandon.qsitehost.com');
      expect(tenantSiteUrl('sandon')).toBe('https://sandon.qsitehost.com');
      expect(tenantSiteHosts('sandon')).toEqual(['sandon.qsitehost.com', 'sandon.quicksites.ai']);
      expect(tenantSiteDomains()).toEqual(['qsitehost.com', 'quicksites.ai', 'cedarsites.com', 'pointsevenstudio.com']);
    });
  });
  it('308 target: only a slug on the brand root moves; apex, www/app, resellers and custom domains do not', () => {
    withRoot('qsitehost.com', () => {
      expect(legacyTenantRedirectHost('sandon.quicksites.ai')).toBe('sandon.qsitehost.com');
      expect(legacyTenantRedirectHost('Sandon.QuickSites.ai:443')).toBe('sandon.qsitehost.com');
      expect(legacyTenantRedirectHost('quicksites.ai')).toBeNull();
      expect(legacyTenantRedirectHost('www.quicksites.ai')).toBeNull();
      expect(legacyTenantRedirectHost('app.quicksites.ai')).toBeNull();
      expect(legacyTenantRedirectHost('foo.cedarsites.com')).toBeNull();
      expect(legacyTenantRedirectHost('www.graftontowing.com')).toBeNull();
      expect(legacyTenantRedirectHost('sandon.qsitehost.com')).toBeNull();
    });
  });
  it("the new root's own apex and www are nobody's site", () => {
    withRoot('qsitehost.com', () => {
      expect(isTenantRootApex('qsitehost.com')).toBe(true);
      expect(isTenantRootApex('www.qsitehost.com')).toBe(true);
      expect(isTenantRootApex('sandon.qsitehost.com')).toBe(false);
      expect(isTenantRootApex('quicksites.ai')).toBe(false);
    });
  });
});

describe('siteSlugFromHost', () => {
  it('reads the slug off any platform or reseller subdomain, on either root', () => {
    withRoot('qsitehost.com', () => {
      expect(siteSlugFromHost('sandon.qsitehost.com')).toBe('sandon');
      expect(siteSlugFromHost('sandon.quicksites.ai')).toBe('sandon');
      expect(siteSlugFromHost('Sandon.QuickSites.ai')).toBe('sandon');
      expect(siteSlugFromHost('foo.cedarsites.com')).toBe('foo');
      expect(siteSlugFromHost('a.b.qsitehost.com')).toBe('a');
    });
  });
  it('returns null for an apex, a reserved label, or a custom domain; a roots override narrows it', () => {
    withRoot('qsitehost.com', () => {
      expect(siteSlugFromHost('qsitehost.com')).toBeNull();
      expect(siteSlugFromHost('www.qsitehost.com')).toBeNull();
      expect(siteSlugFromHost('app.quicksites.ai')).toBeNull();
      expect(siteSlugFromHost('www.graftontowing.com')).toBeNull();
      expect(siteSlugFromHost('foo.cedarsites.com', platformSiteRoots())).toBeNull();
    });
  });
  it('isBrandHost covers the apex and every subdomain of the brand, nothing else', () => {
    expect(isBrandHost('quicksites.ai')).toBe(true);
    expect(isBrandHost('www.quicksites.ai')).toBe(true);
    expect(isBrandHost('sandon.quicksites.ai')).toBe(true);
    expect(isBrandHost('notquicksites.ai')).toBe(false);
    expect(isBrandHost('qsitehost.com')).toBe(false);
  });
});

/**
 * SOURCE GUARD. No code outside the registry may build or recognise a tenant host from the brand
 * root. Matches CODE SHAPES, never prose: comments are stripped first (a comment explaining the
 * old host — `grandstead-towing-service.quicksites.ai` — is not a violation; §4 of CLAUDE.md).
 */
const ROOT = path.resolve(__dirname, '../../..');
const SCAN_DIRS = ['lib', 'app', 'components'];
const SCAN_FILES = ['middleware.ts'];
const REGISTRY = path.join('lib', 'sites', 'tenantRoot.ts');

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__' || e.name === '.next') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
}

function stripComments(src: string): string {
  return (
    src
      // `//` to end of line FIRST — a line comment may contain `/*` (one did: "(/admin/templates/*)"
      // in contact-form.tsx opened a block comment that never closed and hid a real violation).
      // Not the `//` of a URL (preceded by `:`) and not an escaped one.
      .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1')
      .replace(/\/\*[\s\S]*?\*\//g, '')
  );
}

const SHAPES: Array<{ name: string; re: RegExp }> = [
  { name: 'template literal `${…}.quicksites.ai`', re: /\$\{[^}]*\}\.quicksites\.ai/ },
  { name: "endsWith('.quicksites.ai')", re: /endsWith\(\s*['"]\.quicksites\.ai['"]\s*\)/ },
  { name: 'regex host match /…quicksites\\.ai$/', re: /quicksites\\\.ai\$/ },
  // A DEFAULT or CONSTANT host: `= 'quicksites.ai'`, `?? 'quicksites.ai'`, `|| '.quicksites.ai'`,
  // `['quicksites.ai', …]`. The app's own URL (`'https://www.quicksites.ai'`) is not a tenant host.
  { name: "a host constant/default 'quicksites.ai' / '.quicksites.ai'", re: /(=|\?\?|\|\||\[)\s*['"]\.?quicksites\.ai['"]/ },
];

describe('source guard — only lib/sites/tenantRoot.ts spells the tenant root', () => {
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  for (const f of SCAN_FILES) files.push(path.join(ROOT, f));

  it('scans a non-empty file set', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('no file outside the registry builds or recognises a tenant host from the brand root', () => {
    const hits: string[] = [];
    for (const f of files) {
      const rel = path.relative(ROOT, f);
      if (rel === REGISTRY) continue;
      const code = stripComments(fs.readFileSync(f, 'utf8'));
      for (const s of SHAPES) {
        const m = s.re.exec(code);
        if (m) hits.push(`${rel}: ${s.name} → ${m[0].slice(0, 60)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('the guard itself catches each shape (so a silent regex change cannot bless the fleet)', () => {
    const samples = [
      'const u = `https://${slug}.quicksites.ai`;',
      "if (host.endsWith('.quicksites.ai')) return host.split('.')[0];",
      'const m = host.match(/^([a-z0-9-]+)\\.quicksites\\.ai$/);',
      "const PLATFORM_BASE = 'quicksites.ai';",
      "const ORIGIN_SUFFIX = '.quicksites.ai';",
    ];
    for (const s of samples) expect(SHAPES.some((x) => x.re.test(stripComments(s)))).toBe(true);
    // Not violations: the app's own URL, a comment naming the old host, a brand check on a
    // `www.` URL default, and a line comment that happens to contain `/*`.
    for (const ok of [
      "'https://www.quicksites.ai'",
      '// served at `sandon.quicksites.ai`',
      "metadataBase: new URL('https://quicksites.ai')",
      "(process.env.NEXT_PUBLIC_APP_URL || 'https://www.quicksites.ai').replace(/\\/+$/, '')",
      "// inside the editor (/admin/templates/*).\nconst x = 1;\n// `foo.quicksites.ai`",
    ]) {
      expect(SHAPES.some((x) => x.re.test(stripComments(ok)))).toBe(false);
    }
    // And the stripper does not let a `/*` inside a line comment swallow the code after it.
    expect(stripComments("// see (/admin/*)\nconst u = `https://${slug}.quicksites.ai`;")).toContain('${slug}.quicksites.ai');
  });
});
