// lib/cron/__tests__/auth.test.ts
//
// Locks in that isCronAuthorized accepts the way Vercel's scheduler actually
// authenticates a cron: `Authorization: Bearer <CRON_SECRET>`. A cron that only
// checked the custom `x-cron-secret` header (which Vercel never sends) was
// silently 403'd by the platform scheduler and never ran — this guards that class
// of regression, alongside the custom-header paths our manual triggers use.

import { isCronAuthorized } from '../auth';

const SECRET = 'test-cron-secret';
const reqWith = (headers: Record<string, string>) =>
  ({ headers: new Headers(headers) } as unknown as Request);

describe('isCronAuthorized', () => {
  const OLD = process.env.CRON_SECRET;
  beforeEach(() => { process.env.CRON_SECRET = SECRET; });
  afterEach(() => {
    if (OLD === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = OLD;
  });

  it("accepts Vercel's native Authorization: Bearer <secret>", () => {
    expect(isCronAuthorized(reqWith({ authorization: `Bearer ${SECRET}` }))).toBe(true);
  });

  it('accepts the custom x-cron-secret header', () => {
    expect(isCronAuthorized(reqWith({ 'x-cron-secret': SECRET }))).toBe(true);
  });

  it('accepts the custom x-cron-key header', () => {
    expect(isCronAuthorized(reqWith({ 'x-cron-key': SECRET }))).toBe(true);
  });

  it('rejects a wrong secret in any accepted header', () => {
    expect(isCronAuthorized(reqWith({ authorization: 'Bearer nope' }))).toBe(false);
    expect(isCronAuthorized(reqWith({ 'x-cron-secret': 'nope' }))).toBe(false);
  });

  it('rejects a bare secret in Authorization (missing the Bearer scheme)', () => {
    expect(isCronAuthorized(reqWith({ authorization: SECRET }))).toBe(false);
  });

  it('rejects a request with no auth headers', () => {
    expect(isCronAuthorized(reqWith({}))).toBe(false);
  });

  it('rejects everything when CRON_SECRET is unset (fail closed)', () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(reqWith({ authorization: `Bearer ${SECRET}` }))).toBe(false);
    expect(isCronAuthorized(reqWith({ 'x-cron-secret': SECRET }))).toBe(false);
  });
});
