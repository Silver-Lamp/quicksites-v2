// lib/ai/pricing-sync/openaiSync.ts
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseOpenAI } from '@/lib/ai/pricing-scrapers/openai';

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

type Opts = {
  provider?: string;              // default 'openai'
  safeDeltaPct?: number;          // auto-apply threshold (defaults to 8)
  urlOverride?: string;           // override pricing URL (tests)
  logSampleOnZeroRows?: boolean;  // default true
  enableHeadless?: boolean;       // default from env ENABLE_HEADLESS_PRICING
};

type SyncResult = {
  ok: true;
  status: number;
  applied: number;
  queued: number;
  note?: string;
  strategy?: string;
};

const DEFAULT_URL = 'https://platform.openai.com/docs/pricing';
const MIN_HTML_BYTES = 5000; // treat smaller as suspicious (JS shell)
const HEADLESS_ENV = process.env.ENABLE_HEADLESS_PRICING?.toLowerCase() === 'true';

export async function syncOpenAIPrices(opts: Opts = {}): Promise<SyncResult> {
  const PROVIDER = opts.provider ?? 'openai';
  const SAFE_DELTA_PCT = opts.safeDeltaPct ?? 8;
  const LOG_SAMPLE = opts.logSampleOnZeroRows ?? true;
  const USE_HEADLESS = opts.enableHeadless ?? HEADLESS_ENV;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Load source row (non-fatal if missing)
  let source: any | null = null;
  try {
    const { data } = await admin
      .from('ai_pricing_sources')
      .select('*')
      .eq('provider', PROVIDER)
      .maybeSingle();
    source = data ?? null;
  } catch {
    /* ignore */
  }

  const url = opts.urlOverride || source?.url || DEFAULT_URL;

  // 1) Try simple fetch first
  const simpleHeaders: Record<string, string> = {
    'user-agent': 'QuickSites/ai-pricing-sync',
    'accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    ...(source?.etag ? { 'if-none-match': source.etag } : {}),
  };

  let status = 0;
  let etag: string | null = null;
  let html = '';
  let headlessText = '';
  let strategy: 'simple' | 'headless:html' | 'headless:text' | 'simple+hash' = 'simple';

  const res = await fetch(url, { headers: simpleHeaders });
  status = res.status;
  etag = res.headers.get('etag') || null;

  if (status === 304) {
    await upsertSource(admin as any, PROVIDER, { etag, last_status: 304, last_checked: nowISO() });
    return { ok: true, status: 304, applied: 0, queued: 0, strategy };
  }

  html = await res.text();
  const bytes = html.length;

  // tiny/suspicious? try headless if allowed
  if ((status >= 400 || bytes < MIN_HTML_BYTES) && USE_HEADLESS) {
    const headless = await tryHeadless(url);
    if (headless) {
      // Prefer text (DOM innerText) since the docs site is client-rendered
      if (headless.text && headless.text.length > 200) {
        headlessText = headless.text;
        strategy = 'headless:text';
      } else if (headless.html && headless.html.length > bytes) {
        html = headless.html;
        strategy = 'headless:html';
      }
      status = headless.status ?? status;
    }
  }

  // If still tiny or 4xx, bail with a helpful message
  if (status >= 400 || (strategy === 'simple' && html.length < MIN_HTML_BYTES)) {
    await upsertSource(admin as any, PROVIDER, { etag, last_status: status, last_checked: nowISO() });
    throw new Error(
      `Pricing page fetch looked wrong (status=${status}, bytes=${html.length}, strategy=${strategy}).` +
        (USE_HEADLESS ? '' : ' Enable headless by setting ENABLE_HEADLESS_PRICING=true and install puppeteer.')
    );
  }

  // Hash check (based on HTML only, not text)
  if (strategy === 'simple') {
    const hash = sha(html);
    if (source?.last_hash === hash) {
      await upsertSource(admin as any, PROVIDER, {
        etag,
        last_status: status,
        last_hash: hash,
        last_checked: nowISO(),
      });
      return { ok: true, status, applied: 0, queued: 0, note: 'hash unchanged', strategy: 'simple+hash' };
    }
  }

  // Parse
  // If we have headlessText, wrap it so the existing parser (Cheerio) can read it via $('main').text()
  let parseInput = html;
  if (headlessText) {
    parseInput = `<main>${escapeHtml(headlessText)}</main>`;
  }

  let parsed = parseOpenAI(parseInput);
  if (!parsed.length && strategy !== 'headless:text' && USE_HEADLESS) {
    // last-ditch: try to extract innerText now even if we didn’t get it earlier
    const fallback = await tryHeadless(url);
    if (fallback?.text) {
      const wrapped = `<main>${escapeHtml(fallback.text)}</main>`;
      parsed = parseOpenAI(wrapped);
      strategy = 'headless:text';
    }
  }

  if (!parsed.length) {
    if (LOG_SAMPLE) {
      console.error('[openaiPricing] 0 rows parsed. First 2000 chars:\n', (headlessText || html).slice(0, 2000));
    }
    throw new Error(`OpenAI pricing parser found 0 rows (strategy=${strategy}).`);
  }

  // Helpers
  const pct = (oldVal?: number | null, nextVal?: number | null) => {
    if (oldVal == null || nextVal == null || oldVal === 0) return null;
    return Math.abs((nextVal - oldVal) / oldVal) * 100;
  };
  const primary = (r: any) =>
    r?.input_per_1k_usd ?? r?.image_base_usd ?? r?.stt_per_min_usd ?? r?.tts_per_1k_chars_usd ?? null;

  // Upserts + audit
  let applied = 0;
  let queued = 0;

  for (const r of parsed) {
    const { data: current } = await admin
      .from('ai_model_pricing')
      .select('*')
      .eq('provider', PROVIDER)
      .eq('model_code', r.model_code)
      .eq('modality', r.modality)
      .maybeSingle();

    const next = {
      provider: PROVIDER,
      model_code: r.model_code,
      modality: r.modality,
      input_per_1k_usd: r.input_per_1k_usd ?? null,
      output_per_1k_usd: r.output_per_1k_usd ?? null,
      image_base_usd: r.image_base_usd ?? null,
      image_per_mp_usd: r.image_per_mp_usd ?? null,
      stt_per_min_usd: r.stt_per_min_usd ?? null,
      tts_per_1k_chars_usd: r.tts_per_1k_chars_usd ?? null,
      is_active: true,
    } as const;

    const delta = pct(primary(current), primary(next));
    const isNew = !current;

    const { data: audit, error: auditErr } = await admin
      .from('ai_pricing_audit')
      .insert({
        provider: PROVIDER,
        model_code: r.model_code,
        modality: r.modality,
        old: current || null,
        new: next,
        change_pct: delta == null ? null : +delta.toFixed(2),
        applied: false,
        message: isNew ? 'new model detected' : 'auto-detect',
        action: 'auto-detect',
      })
      .select('*')
      .single();
    if (auditErr) throw auditErr;

    if (isNew || (delta != null && delta > SAFE_DELTA_PCT)) {
      queued++;
      continue;
    }

    await admin.from('ai_model_pricing').upsert(next, { onConflict: 'provider,model_code,modality' });
    await admin
      .from('ai_pricing_audit')
      .update({ applied: true, action: 'auto-apply', reviewed_at: nowISO() })
      .eq('id', audit.id);

    applied++;
  }

  // Update source row (only hash when we used HTML path)
  const hashPatch: Record<string, any> = headlessText ? {} : { last_hash: sha(html) };
  await upsertSource(admin as any, PROVIDER, {
    url,
    etag,
    last_status: status,
    last_checked: nowISO(),
    ...hashPatch,
  });

  return { ok: true, status, applied, queued, strategy };
}

/* ---------- helpers ---------- */

function nowISO() {
  return new Date().toISOString();
}

async function upsertSource(
  admin: ReturnType<typeof createClient> & { from: any },
  provider: string,
  patch: Record<string, any>
) {
  const { error } = await admin
    .from('ai_pricing_sources')
    .upsert({ provider, ...patch }, { onConflict: 'provider' });
  if (error) {
    console.warn('[openaiPricing] upsertSource warning:', error.message);
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// Headless: prefer puppeteer in dev; fallback to puppeteer-core + @sparticuz/chromium
async function tryHeadless(
  url: string
): Promise<{ html?: string; text?: string; status?: number } | null> {
  try {
    // 1) Dev: puppeteer (simpler locally)
    try {
      const { default: puppeteer } = await import('puppeteer');
      const browser = await puppeteer.launch({
        headless: 'new' as any,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (compatible; QuickSites/ai-pricing-sync; +https://quicksites.ai)'
      );
      await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: Number(process.env.PRICING_HEADLESS_TIMEOUT_MS ?? 45000),
      });
      await page.waitForSelector('main,article,table', { timeout: 10000 }).catch(() => {});
      const text = await page.evaluate(
        () => document.querySelector('main')?.innerText || document.body.innerText || ''
      );
      const content = await page.content();
      await browser.close();
      return { html: content, text, status: 200 };
    } catch {
      // continue to serverless fallback
    }

    // 2) Serverless: puppeteer-core + @sparticuz/chromium
    const { default: chromium } = await import('@sparticuz/chromium');
    const { default: puppeteerCore } = await import('puppeteer-core');

    const executablePath = await chromium.executablePath();
    const browser = await puppeteerCore.launch({
      args: (chromium as any).args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath,
      headless: (chromium as any).headless ?? true,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (compatible; QuickSites/ai-pricing-sync; +https://quicksites.ai)'
    );
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: Number(process.env.PRICING_HEADLESS_TIMEOUT_MS ?? 45000),
    });
    await page.waitForSelector('main,article,table', { timeout: 10000 }).catch(() => {});
    const text = await page.evaluate(
      () => document.querySelector('main')?.innerText || document.body.innerText || ''
    );
    const content = await page.content();
    await browser.close();
    return { html: content, text, status: 200 };
  } catch (e) {
    console.warn('[openaiPricing] Headless fetch failed:', (e as any)?.message || e);
    return null;
  }
}
