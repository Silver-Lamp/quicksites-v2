import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Review = {
  quote: string;
  attribution?: string | null;
  rating?: number | null;
  date?: string | null;
};

function bad(text: string, code = 400) {
  return new NextResponse(text, {
    status: code,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
function normalizeUrl(u: string) {
  try { const x = new URL(u); x.hash = ''; return x.toString(); } catch { return u; }
}
function detect(href: string): 'yelp'|'unknown' {
  try { return new URL(href).hostname.toLowerCase().includes('yelp.com') ? 'yelp' : 'unknown'; }
  catch { return 'unknown'; }
}
function coerceBase(raw?: string|null) {
  let v = (raw || '').trim();
  if (!v) return null;
  v = v.replace(/\/+$/,'');          // no trailing slash
  v = v.replace(/^http:\/\//i,'https://'); // force https
  return v;
}
function sanitize(revs: any[]): Review[] {
  return (Array.isArray(revs) ? revs : [])
    .map((r) => ({
      quote: String(r?.quote ?? '').trim(),
      attribution: r?.attribution ? String(r.attribution).trim() : null,
      rating:
        typeof r?.rating === 'number' && Number.isFinite(r.rating)
          ? Math.max(1, Math.min(5, Math.round(r.rating)))
          : null,
      date: r?.date ?? null,
    }))
    .filter((r) => r.quote.length > 0);
}
function parasToReviews(txt: string): Review[] {
  const paras = (txt || '')
    .split(/\n{2,}/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);
  return paras.map((q) => ({ quote: q }));
}

async function fetchWorkerJSON(workerBase: string, url: string, debugQS = '') {
  const r = await fetch(
    `${workerBase}?url=${encodeURIComponent(url)}&mode=render&format=json${debugQS}`,
    { headers: { accept: 'application/json' } }
  );
  const ct = r.headers.get('content-type') || '';
  let data: any = null;
  try { data = ct.includes('json') ? await r.json() : null; } catch {}
  return { status: r.status, data, ct };
}

async function fetchWorkerReaderText(workerBase: string, url: string, debugQS = '') {
  const r = await fetch(
    `${workerBase}?url=${encodeURIComponent(url)}&mode=reader${debugQS}`,
    { headers: { accept: 'text/plain' } }
  );
  const txt = await r.text();
  return { status: r.status, text: txt, ct: r.headers.get('content-type') || '' };
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const trace: any[] = [];
  try {
    const urlObj = new URL(req.url);
    const qsDebug = urlObj.searchParams.get('debug') === '1';
    const body = await req.json().catch(() => ({}));
    const { url, limit } = (body || {}) as { url?: string; limit?: number };

    if (!url) return bad('Missing url');
    const href = normalizeUrl(url);
    if (detect(href) !== 'yelp') return bad('Unsupported URL. Only Yelp review pages for now.');

    // Prefer REVIEWS_WORKER_URL, fallback to REVIEWS_PROXY_URL
    const base =
      coerceBase(process.env.REVIEWS_WORKER_URL) ||
      coerceBase(process.env.REVIEWS_PROXY_URL);

    if (!base) return bad('Worker URL not configured (set REVIEWS_WORKER_URL)', 500);

    const dbg = qsDebug || process.env.REVIEWS_IMPORT_DEBUG === '1' ? '&debug=1' : '';

    // 1) Primary: Worker render+JSON (no HTML parsing on server)
    const r1 = await fetchWorkerJSON(base, href, dbg);
    trace.push({ step: 'worker-render-json', status: r1.status, ct: r1.ct, hasData: !!r1.data });

    let reviews: Review[] = [];
    if (r1.status >= 200 && r1.status < 400 && r1?.data?.reviews) {
      reviews = sanitize(r1.data.reviews);
    }

    // 2) Fallback: Worker reader (plaintext) → paragraph extractor (still no HTML parsing)
    if (!reviews.length) {
      const r2 = await fetchWorkerReaderText(base, href, dbg);
      trace.push({ step: 'worker-reader-text', status: r2.status, ct: r2.ct, len: r2.text.length });
      if (r2.status >= 200 && r2.status < 400) {
        reviews = parasToReviews(r2.text);
      }
    }

    // Limit, sanitize (already sanitized), final check
    if (typeof limit === 'number' && reviews.length > limit) {
      reviews = reviews.slice(0, Math.max(1, limit));
    }

    trace.push({ finalCount: reviews.length });

    if (!reviews.length) return bad(`No reviews found via worker JSON/reader.\ntrace=${JSON.stringify(trace)}`, 502);

    const payload: any = { reviews, source: { provider: 'yelp', url: href } };
    if (qsDebug || process.env.REVIEWS_IMPORT_DEBUG === '1') {
      payload.debug = { trace, tookMs: Date.now() - t0 };
      try { console.log('[import-worker debug]', JSON.stringify(payload.debug, null, 2)); } catch {}
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    trace.push({ error: String(err?.message || err) });
    const lines = [
      `Import-worker failed: ${String(err?.message || err)}`,
      `trace=${JSON.stringify(trace)}`,
    ];
    return bad(lines.join('\n'), 500);
  }
}
