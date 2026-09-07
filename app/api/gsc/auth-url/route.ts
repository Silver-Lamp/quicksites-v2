// app/api/gsc/auth-url/route.ts
//
// The Search Console (re)connect entry point. GET redirects straight to Google's consent screen —
// the admin nav links here, and returning JSON meant an operator landed on a page of raw text and
// had to copy a URL out of it by hand. `?format=json` keeps the old shape for debugging.
import { NextResponse } from 'next/server';
import { gscClientId, gscRedirectUri } from '@/lib/gsc/oauthConfig';

export const dynamic = 'force-dynamic';

/**
 * ⚠️ redirect_uri_mismatch is the failure this page exists to explain. Google rejects the request
 * when the redirect_uri we send is not registered on the OAuth client, and its own error screen
 * does NOT say which URI was sent or where to put it — so it reads like "I picked the wrong
 * account". It is neither the account nor the scopes; it is one string in the Cloud console.
 */
function helpPage(redirectUri: string, clientId: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return `<!doctype html><meta charset="utf-8"><title>Connect Search Console</title>
<style>
  body{background:#0b0f14;color:#e6edf3;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:3rem 1.5rem}
  main{max-width:44rem;margin:0 auto}
  h1{font-size:1.5rem;margin:0 0 .5rem}
  code{background:#161b22;border:1px solid #30363d;border-radius:4px;padding:.15rem .4rem;font-size:.9em;word-break:break-all}
  .uri{display:block;margin:.6rem 0;padding:.7rem .8rem;background:#161b22;border:1px solid #3fb950;border-radius:6px;color:#7ee787}
  ol{padding-left:1.2rem}li{margin:.4rem 0}
  a{color:#58a6ff}
  .muted{color:#8b949e;font-size:.92em}
</style>
<main>
<h1>Search Console isn’t configured for this host</h1>
<p class="muted">Google will reject the consent request with <code>Error 400: redirect_uri_mismatch</code> until the URI below is registered on the OAuth client. It is not an account problem and not a scope problem.</p>
<p><strong>Register exactly this redirect URI:</strong></p>
<code class="uri">${esc(redirectUri)}</code>
<ol>
  <li>Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud console → APIs &amp; Services → Credentials</a>.</li>
  <li>Open the OAuth 2.0 Client ID starting <code>${esc(clientId.slice(0, 24))}…</code></li>
  <li>Under <strong>Authorized redirect URIs</strong>, add the URI above. It must match character for character — <code>www</code>, <code>https</code>, no trailing slash.</li>
  <li>Save, wait a minute, then <a href="/api/gsc/auth-url">try connecting again</a>.</li>
</ol>
<p class="muted">Sign in with the Google account that owns the Search Console properties — not necessarily the one you use for QuickSites.</p>
</main>`;
}

export async function GET(req: Request) {
  const clientId = gscClientId();
  const redirectUri = gscRedirectUri();
  const wantsJson = new URL(req.url).searchParams.get('format') === 'json';

  if (!clientId) {
    const msg = 'Google Search Console is not configured (missing GOOGLE_CLIENT_ID / GSC_CLIENT_ID).';
    return wantsJson
      ? NextResponse.json({ error: msg }, { status: 500 })
      : new NextResponse(helpPage(redirectUri, ''), { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // webmasters (read-WRITE, so we can programmatically add geo-domains as properties) +
    // siteverification (so we can DNS-TXT-verify them). Superset of the old readonly scope,
    // so reads keep working — but existing connections must RE-CONSENT once to grant write.
    scope: [
      'https://www.googleapis.com/auth/webmasters',
      'https://www.googleapis.com/auth/siteverification',
    ].join(' '),
    access_type: 'offline',
    // Forces a NEW refresh token, which is what actually upgrades the stored grant's scopes.
    // Without it Google silently reuses the old consent and the write scopes never arrive.
    prompt: 'consent',
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // The help page is reachable on demand, so a mismatch has somewhere to send you.
  if (new URL(req.url).searchParams.get('help') === '1') {
    return new NextResponse(helpPage(redirectUri, clientId), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  return wantsJson ? NextResponse.json({ url, redirectUri }) : NextResponse.redirect(url);
}
