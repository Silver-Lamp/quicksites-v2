/**
 * @jest-environment node
 */

/**
 * ⚠️ The PIN is read at MODULE LOAD, so env must be set before the import. `jest.isolateModulesAsync`
 * gives each case its own copy of the module rather than leaking one env across the file.
 */
async function withEnv<T>(env: Record<string, string | undefined>, fn: (m: any) => T): Promise<T> {
  const prev = { ...process.env };
  // ⚠️ DELETE rather than assign for an absent key. `process.env` coerces values to strings, so
  // `process.env.X = undefined` stores the literal "undefined" — which is TRUTHY, and made the
  // fails-closed test report a configured PIN when it meant to test an unset one. The test caught it.
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  let out!: T;
  await jest.isolateModulesAsync(async () => {
    const m = await import('@/lib/auth/pagePin');
    out = fn(m);
  });
  process.env = prev;
  return out;
}

// ⚠️ A DELIBERATELY FAKE PIN. The first draft of this file used the real one, which would have
// published it to every clone of the repo — the exact failure `pagePin.ts` keeps out of the source,
// reintroduced through the back door of its own test. A test needs *a* configured PIN, never *the*
// configured PIN.
const CONFIGURED = { PAGE_PIN_AMY: '000001', CLAIM_TOKEN_SECRET: 'test-secret-for-signing' };

describe('the gate fails closed', () => {
  // The dangerous default. A gate that is open when unconfigured protects nothing on exactly the
  // deploy where somebody forgot the env var — and /for-amy carries a pay schedule.
  it('reports the page as ungated when no PIN is configured', async () => {
    const gated = await withEnv({ PAGE_PIN_AMY: undefined, CLAIM_TOKEN_SECRET: 's' }, (m) =>
      m.pageRequiresPin('amy')
    );
    expect(gated).toBe(false);
  });

  it('accepts NO input when no PIN is configured, not even an empty one', async () => {
    const results = await withEnv({ PAGE_PIN_AMY: undefined, CLAIM_TOKEN_SECRET: 's' }, (m) => [
      m.checkPagePin('amy', ''),
      m.checkPagePin('amy', '000001'),
      m.checkPagePin('amy', undefined),
    ]);
    expect(results).toEqual([false, false, false]);
  });

  it('never unlocks a page it has never heard of', async () => {
    const r = await withEnv(CONFIGURED, (m) => [
      m.pageRequiresPin('nobody'),
      m.checkPagePin('nobody', '000001'),
    ]);
    expect(r).toEqual([false, false]);
  });
});

describe('checking the PIN', () => {
  it('accepts the configured code and rejects near misses', async () => {
    const r = await withEnv(CONFIGURED, (m) => ({
      exact: m.checkPagePin('amy', '000001'),
      padded: m.checkPagePin('amy', ' 000001 '), // a pasted code carries whitespace
      wrong: m.checkPagePin('amy', '000002'),
      prefix: m.checkPagePin('amy', '00000'),
      longer: m.checkPagePin('amy', '0000012'),
      empty: m.checkPagePin('amy', ''),
    }));
    expect(r).toEqual({
      exact: true,
      padded: true,
      wrong: false,
      prefix: false,
      longer: false,
      empty: false,
    });
  });
});

describe('the grant cookie', () => {
  it('round-trips for the page it was minted for', async () => {
    const ok = await withEnv(CONFIGURED, (m) =>
      m.verifyPagePinGrant(m.mintPagePinGrant('amy'), 'amy')
    );
    expect(ok).toBe(true);
  });

  // ⚠️ One code must not be a master key. The /for-<name> pages have different audiences, so a grant
  // is bound to its page and a leaked code opens only that one.
  it('does not open a different page', async () => {
    const ok = await withEnv(CONFIGURED, (m) =>
      m.verifyPagePinGrant(m.mintPagePinGrant('amy'), 'daryle')
    );
    expect(ok).toBe(false);
  });

  // An unsigned `pin_ok=1` cookie is a gate anyone opens with devtools.
  it('rejects a forged or tampered cookie', async () => {
    const r = await withEnv(CONFIGURED, (m) => {
      const good = m.mintPagePinGrant('amy');
      const [body] = good.split('.');
      return [
        m.verifyPagePinGrant('1', 'amy'),
        m.verifyPagePinGrant('true', 'amy'),
        m.verifyPagePinGrant(`${body}.not-the-signature`, 'amy'),
        m.verifyPagePinGrant(body, 'amy'), // no signature at all
        m.verifyPagePinGrant(undefined, 'amy'),
      ];
    });
    expect(r).toEqual([false, false, false, false, false]);
  });

  it('expires', async () => {
    const ok = await withEnv(CONFIGURED, (m) => {
      const minted = m.mintPagePinGrant('amy', 1_000);
      return m.verifyPagePinGrant(minted, 'amy', 1_000 + m.PAGE_PIN_TTL_MS + 1);
    });
    expect(ok).toBe(false);
  });

  // The signature depends on a secret; a deploy without one must not hand out verifiable grants.
  it('verifies nothing when there is no signing secret', async () => {
    const ok = await withEnv(
      {
        PAGE_PIN_AMY: '000001',
        CLAIM_TOKEN_SECRET: undefined,
        SUPABASE_JWT_SECRET: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        SUPABASE_SECRET_KEY: undefined,
      },
      (m) => m.verifyPagePinGrant(m.mintPagePinGrant('amy'), 'amy')
    );
    expect(ok).toBe(false);
  });
});

describe('the rate limit is the real defence, so it must be tight', () => {
  it('allows only a handful of attempts an hour', async () => {
    const n = await withEnv(CONFIGURED, (m) => m.PAGE_PIN_MAX_ATTEMPTS_PER_HOUR);
    // 1e6 combinations at this rate is years. Raising it meaningfully weakens the whole gate.
    expect(n).toBeLessThanOrEqual(20);
    expect(n).toBeGreaterThan(0);
  });
});

describe('source guards — a unit test cannot see a deleted line', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(process.cwd(), 'lib/auth/pagePin.ts'),
    'utf8'
  );

  // ⚠️ A six-digit literal is too short for any secret scanner to flag, so a hardcoded PIN would
  // look protected and be published in every clone. Only env reads are allowed here.
  it('holds no six-digit literal', () => {
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/['"`]\d{6}['"`]/);
  });

  it('compares in constant time rather than with ===', () => {
    expect(src).toContain('timingSafeEqual');
  });

  const route = require('node:fs').readFileSync(
    require('node:path').join(process.cwd(), 'app/api/page-pin/route.ts'),
    'utf8'
  );

  // The limiter swallows its own insert errors, so a throw here must mean "denied", never "allowed".
  it('the route fails closed when the limiter throws', () => {
    expect(route).toMatch(/catch\s*{\s*allowed\s*=\s*false/);
  });

  it('the route never echoes the submitted PIN back', () => {
    expect(route).not.toMatch(/searchParams\.set\([^)]*pin/i);
  });
});
