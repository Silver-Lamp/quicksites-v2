/**
 * @jest-environment node
 */
// The (re)connect entry point. Two failures it exists to prevent, both of which happened:
//  1. It returned JSON, so the admin nav link landed an operator on a page of raw text with a URL
//     to copy out by hand.
//  2. Google's redirect_uri_mismatch screen names neither the URI that was sent nor where to
//     register it, so it reads as "I picked the wrong Google account" — which no account fixes.
import { GET } from '../auth-url/route';

const call = (qs = '') => GET(new Request(`https://www.quicksites.ai/api/gsc/auth-url${qs}`));

describe('connecting is one click', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GSC_BASE_URL = 'https://www.quicksites.ai';
  });

  it('redirects straight to Google rather than printing JSON at a human', async () => {
    const res = await call();
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location') ?? '').toContain('accounts.google.com/o/oauth2/v2/auth');
  });

  it('asks for BOTH upgraded scopes, and forces a new refresh token', async () => {
    const to = decodeURIComponent((await call()).headers.get('location') ?? '');
    // Without prompt=consent Google silently reuses the old grant and the write scopes never
    // arrive — the re-consent appears to succeed and changes nothing.
    expect(to).toContain('prompt=consent');
    expect(to).toContain('access_type=offline');
    expect(to).toContain('auth/webmasters');
    expect(to).toContain('auth/siteverification');
  });

  it('still exposes the JSON shape for debugging, with the redirect URI named', async () => {
    const body = await (await call('?format=json')).json();
    expect(body.url).toContain('accounts.google.com');
    expect(body.redirectUri).toBe('https://www.quicksites.ai/api/gsc/oauth-callback');
  });
});

describe('the mismatch has somewhere to send you', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GSC_BASE_URL = 'https://www.quicksites.ai';
  });

  it('?help=1 states the exact URI to register and where to put it', async () => {
    const html = await (await call('?help=1')).text();
    expect(html).toContain('https://www.quicksites.ai/api/gsc/oauth-callback');
    expect(html).toContain('Authorized redirect URIs');
    expect(html).toContain('console.cloud.google.com/apis/credentials');
  });

  it('says it is not an account problem, because that is what it looks like', async () => {
    expect(await (await call('?help=1')).text()).toMatch(/not an account problem/i);
  });

  it('explains rather than 500s blankly when the client id is missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GSC_CLIENT_ID;
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('/api/gsc/oauth-callback');
  });
});
