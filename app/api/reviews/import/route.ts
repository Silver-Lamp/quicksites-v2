// app/api/reviews/import/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

/* ───────── Types ───────── */

type Review = {
  quote: string;
  attribution?: string | null;
  rating?: number | null;
  date?: string | null;
};

type FetchResult = {
  via: 'worker-json' | 'direct' | 'proxy' | 'render' | 'reader';
  status: number; // -1 means fetch threw before getting a response
  html: string;
  headers: Record<string, string | null>;
  meta: Record<string, any>;
};

/* ───────── Constants ───────── */

const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'upgrade-insecure-requests': '1',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  referer: 'https://www.yelp.com/',
};

/* ───────── Utils ───────── */

function bad(text: string, code = 400) {
  return new NextResponse(text, {
    status: code,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
function normalizeUrl(u: string) {
  try {
    const x = new URL(u);
    x.hash = '';
    return x.toString();
  } catch {
    return u;
  }
}
function detect(href: string): 'yelp' | 'unknown' {
  try {
    return new URL(href).hostname.toLowerCase().includes('yelp.com') ? 'yelp' : 'unknown';
  } catch {
    return 'unknown';
  }
}
function safeJson<T = any>(s: string): T | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
function coerceBase(raw?: string | null) {
  let v = (raw || '').trim();
  if (!v) return null;
  v = v.replace(/\/+$/g, ''); // strip trailing slash(es)
  v = v.replace(/^http:\/\//i, 'https://'); // force https
  return v;
}

/** Heuristics for JS challenge / bot-wall pages returned as 200 HTML */
function looksBlocked(html: string, contentType: string | null | undefined) {
  const ct = (contentType || '').toLowerCase();
  if (
    /Please enable JS and disable any ad blocker|__cf_chl|cf-error|captcha|data-cfasync|px-captcha|perimeterx/i.test(
      html
    )
  )
    return true;
  if (ct.includes('text/html') && /<title>\s*yelp\.com\s*<\/title>/i.test(html) && html.length < 4000)
    return true;
  return false;
}

/* ───────── Extractors ───────── */

function extractJsonLd($: cheerio.CheerioAPI) {
  const out: Review[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    const parsed = safeJson<any>(raw);
    if (!parsed) return;

    const visit = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (typeof node === 'object') {
        if ((node['@type'] === 'Review' || node.type === 'Review') && (node.reviewBody || node.description)) {
          const body = String(node.reviewBody || node.description || '').trim();
          const author =
            (typeof node.author === 'string' && node.author) ||
            (node.author && (node.author.name || node.author['@name']));
          const rating = node.reviewRating?.ratingValue ?? node.ratingValue;
          const date = node.datePublished || node.dateCreated || null;
          if (body)
            out.push({
              quote: body,
              attribution: author || null,
              rating: rating ? Number(rating) : null,
              date,
            });
        }
        if (node.review) visit(node.review);
        if (node.reviews) visit(node.reviews);
        if (node.itemListElement) visit(node.itemListElement);
        for (const k of Object.keys(node))
          if (k !== '@context' && k !== '@type') visit(node[k]);
      }
    };
    visit(parsed);
  });
  return out;
}

function extractHtmlHeuristics($: cheerio.CheerioAPI) {
  const out: Review[] = [];

  $('[itemtype="http://schema.org/Review"], [itemprop="review"]').each((_, el) => {
    const n = $(el);
    const body =
      n.find('[itemprop="reviewBody"]').text().trim() ||
      n.find('[itemprop="description"]').text().trim();
    const author =
      n.find('[itemprop="author"]').text().trim() ||
      n.find('[itemprop="name"]').first().text().trim();
    const ratingStr =
      n.find('[itemprop="ratingValue"]').attr('content') ||
      n.find('[itemprop="ratingValue"]').text().trim();
    const rating = ratingStr ? Number(ratingStr) : null;
    if (body) out.push({ quote: body, attribution: author || null, rating });
  });

  $('div[aria-label*="star rating"], div[role="img"][aria-label*="star"]').each((_, el) => {
    const label = (($(el).attr('aria-label')) || '').toLowerCase();
    const m = label.match(/(\d(?:\.\d)?)\s*star/);
    const rating = m ? Number(m[1]) : null;

    const box = (el as unknown as Element).closest('section, article, li, div');
    if (!box) return;
    const p = box.querySelector('p');
    let quote = p?.textContent?.trim() || '';
    if (!quote) {
      const span = Array.from(box.querySelectorAll('span'))
        .map((s) => (s as Element).textContent?.trim() || '')
        .find((x) => x.length > 40);
      quote = span || '';
    }
    let attribution: string | null = null;
    const nameEl = Array.from(box.querySelectorAll('a, span'))
      .map((s) => s.textContent?.trim() || '')
      .find((x) => x && x.length < 60);
    if (nameEl) attribution = nameEl;

    if (quote && quote.length > 15) out.push({ quote, attribution, rating });
  });

  // de-dupe by quote
  const seen = new Set<string>();
  return out.filter((r) => {
    const key = r.quote.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Reader (plain text) paragraph heuristic
function extractFromPlainText(txt: string) {
  const paras = txt
    .split(/\n{2,}/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);
  return paras.map((q) => ({ quote: q }));
}

/* ───────── Fetchers ───────── */

async function fetchDirect(url: string): Promise<FetchResult> {
  try {
    const r = await fetch(url, { headers: BROWSER_HEADERS });
    const html = await r.text();
    return {
      via: 'direct',
      status: r.status,
      html,
      headers: { 'content-type': r.headers.get('content-type') },
      meta: { length: html.length },
    };
  } catch (err: any) {
    return {
      via: 'direct',
      status: -1,
      html: '',
      headers: {},
      meta: { error: 'FETCH_FAILED', message: String(err) },
    };
  }
}

async function fetchViaProxy(url: string, mode: 'auto' | 'reader' | 'render' = 'auto'): Promise<FetchResult> {
  const base = coerceBase(process.env.REVIEWS_PROXY_URL);
  if (!base) return { via: 'proxy', status: 0, html: '', headers: {}, meta: { error: 'NO_PROXY_ENV' } };
  try {
    const dbg = process.env.REVIEWS_IMPORT_DEBUG === '1' ? '&debug=1' : '';
    const q =
      mode === 'reader'
        ? '&mode=reader'
        : mode === 'render'
        ? '&mode=render&format=html'
        : '&fallback=reader';
    const r = await fetch(`${base}?url=${encodeURIComponent(url)}${dbg}${q}`, {
      headers: { accept: 'text/html' },
    });
    const html = await r.text();
    const ct = r.headers.get('content-type');
    const fall = r.headers.get('x-proxy-fallback') || null; // 'reader' or 'render'
    return {
      via: fall === 'reader' ? 'reader' : mode === 'render' ? 'render' : 'proxy',
      status: r.status,
      html,
      headers: { 'content-type': ct, 'x-proxy-fallback': fall },
      meta: { length: html.length, proxy: base },
    };
  } catch (err: any) {
    return {
      via: 'proxy',
      status: -1,
      html: '',
      headers: {},
      meta: { error: 'FETCH_FAILED', message: String(err) },
    };
  }
}

async function fetchViaReader(url: string): Promise<FetchResult> {
  const reader = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;
  try {
    const r = await fetch(reader, { headers: { accept: 'text/plain' } });
    const html = await r.text();
    return {
      via: 'reader',
      status: r.status,
      html,
      headers: { 'content-type': r.headers.get('content-type') },
      meta: { length: html.length, reader },
    };
  } catch (err: any) {
    return {
      via: 'reader',
      status: -1,
      html: '',
      headers: {},
      meta: { error: 'FETCH_FAILED', message: String(err), reader },
    };
  }
}

/* ───────── WORKER JSON (render) ───────── */

async function fetchWorkerJSON(url: string): Promise<{ ok: boolean; reviews: Review[]; meta: any }> {
  const base = coerceBase(process.env.REVIEWS_WORKER_URL);
  if (!base) return { ok: false, reviews: [], meta: { error: 'NO_WORKER' } };
  const dbg = process.env.REVIEWS_IMPORT_DEBUG === '1' ? '&debug=1' : '';
  try {
    const r = await fetch(
      `${base}?url=${encodeURIComponent(url)}&mode=render&format=json${dbg}`,
      { headers: { accept: 'application/json' } }
    );
    const ct = r.headers.get('content-type') || '';
    const data: any = ct.includes('json') ? await r.json() : null;
    const raw = Array.isArray(data?.reviews) ? data.reviews : [];
    const reviews: Review[] = raw
      .map((rv: any) => ({
        quote: String(rv?.quote || '').trim(),
        attribution: rv?.attribution ? String(rv.attribution).trim() : null,
        rating:
          typeof rv?.rating === 'number' && Number.isFinite(rv.rating)
            ? Math.max(1, Math.min(5, Math.round(rv.rating)))
            : null,
        date: rv?.date || null,
      }))
      .filter((r: Review) => r.quote.length > 0);
    return { ok: r.ok && reviews.length > 0, reviews, meta: { status: r.status, ct, worker: base } };
  } catch (e: any) {
    return { ok: false, reviews: [], meta: { error: 'FETCH_FAILED', message: String(e) } };
  }
}

/* ───────── Core Import ───────── */

async function importFromYelp(url: string, limit: number | undefined, trace: any[]) {
  const push = (s: Partial<FetchResult>) => trace.push({ ...s });

  // 0) Prefer Worker JSON (render) if configured
  const worker = await fetchWorkerJSON(url);
  push({
    via: 'worker-json',
    status: worker.meta?.status ?? 0,
    html: '',
    headers: { 'content-type': 'application/json' },
    meta: worker.meta,
  });
  if (worker.ok) {
    const trimmed = typeof limit === 'number' ? worker.reviews.slice(0, Math.max(1, limit)) : worker.reviews;
    trace.push({ finalCount: trimmed.length, source: 'worker-json' });
    return { reviews: trimmed };
  }

  // 1) HTML: direct → proxy(auto)
  const direct = await fetchDirect(url);
  push(direct);
  let chosen: FetchResult | null = null;
  if (direct.status >= 200 && direct.status < 400 && !looksBlocked(direct.html, direct.headers['content-type'])) {
    chosen = direct;
  }

  if (!chosen) {
    const prox = await fetchViaProxy(url, 'auto');
    push(prox);
    if (prox.status >= 200 && prox.status < 400 && !looksBlocked(prox.html, prox.headers['content-type'])) {
      chosen = prox;
    }
  }

  // 2) Try rendered HTML from proxy
  if (!chosen) {
    const rendered = await fetchViaProxy(url, 'render');
    push(rendered);
    if (rendered.status >= 200 && rendered.status < 400 && !looksBlocked(rendered.html, rendered.headers['content-type'])) {
      chosen = rendered;
    }
  }

  // 3) Reader (plaintext)
  if (!chosen) {
    const rdr = await fetchViaReader(url);
    push(rdr);
    if (rdr.status >= 200 && rdr.status < 400) {
      const reviews = extractFromPlainText(rdr.html);
      const capped = typeof limit === 'number' ? reviews.slice(0, Math.max(1, limit)) : reviews;
      if (capped.length) return { reviews: capped };
    }
    throw new Error('All fetch paths failed');
  }

  // Parse chosen content
  const res = chosen;
  const ct = (res.headers['content-type'] || '').toLowerCase();

  let reviews: Review[] = [];
  if (res.via === 'reader' || ct.startsWith('text/plain')) {
    reviews = extractFromPlainText(res.html);
    trace.push({ extractor: 'plain_text', count: reviews.length });
  } else {
    const $ = cheerio.load(res.html);
    const scripts = $('script[type="application/ld+json"]').length;
    const jsonld = extractJsonLd($);
    trace.push({ extractor: 'jsonld', scripts, jsonld: jsonld.length });
    reviews = jsonld;
    if (!reviews.length) {
      const heur = extractHtmlHeuristics($);
      trace.push({ extractor: 'heuristics', heuristics: heur.length });
      reviews = heur;
    }
  }

  if (typeof limit === 'number' && reviews.length > limit) reviews = reviews.slice(0, limit);

  // sanitize + clamp
  reviews = reviews
    .map((r) => ({
      quote: (r.quote || '').trim(),
      attribution: r.attribution?.toString().trim() || null,
      rating:
        typeof r.rating === 'number' && Number.isFinite(r.rating)
          ? Math.max(1, Math.min(5, Math.round(r.rating)))
          : null,
      date: r.date || null,
    }))
    .filter((r) => r.quote.length > 0);

  trace.push({ finalCount: reviews.length });
  if (!reviews.length) throw new Error('No reviews found after extraction');

  return { reviews };
}

/* ───────── Route Handler ───────── */

export async function POST(req: Request) {
  const started = Date.now();
  const trace: any[] = [];
  try {
    const urlObj = new URL(req.url);
    const qsDebug = urlObj.searchParams.get('debug') === '1';
    const body = await req.json().catch(() => ({}));
    const { url, limit } = (body || {}) as { url?: string; limit?: number };

    if (!url) return bad('Missing url');
    const href = normalizeUrl(url);
    if (detect(href) !== 'yelp') return bad('Unsupported URL. Only Yelp review pages for now.');

    trace.push({ href, t0: new Date().toISOString() });

    const { reviews } = await importFromYelp(href, limit, trace);

    const payload: any = { reviews, source: { provider: 'yelp', url: href } };
    if (qsDebug || process.env.REVIEWS_IMPORT_DEBUG === '1')
      payload.debug = { trace, tookMs: Date.now() - started };

    if (payload.debug) {
      try {
        console.log('[reviews/import debug]', JSON.stringify(payload.debug, null, 2));
      } catch {}
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    trace.push({ error: String(err?.message || err) });
    const took = Date.now() - started;
    try {
      console.error('[reviews/import ERROR]', { tookMs: took, trace });
    } catch {}
    const lines: string[] = [];
    lines.push(`Import failed: ${String(err?.message || err)}`);
    lines.push(`took=${took}ms`);
    for (const t of trace) {
      if ((t as any).via)
        lines.push(
          `• step=${(t as any).via} status=${(t as any).status} meta=${
            (t as any).meta ? JSON.stringify((t as any).meta) : ''
          }`
        );
      if ((t as any).extractor)
        lines.push(
          `• extractor=${(t as any).extractor} count=${(t as any).jsonld ?? (t as any).heuristics ?? (t as any).count ?? ''}`
        );
      if ((t as any).finalCount != null) lines.push(`• finalCount=${(t as any).finalCount}`);
    }
    return bad(lines.join('\n'), 500);
  }
}
