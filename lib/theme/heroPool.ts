// lib/theme/heroPool.ts
//
// A lazily-filled, per-industry POOL of painterly hero images. Deliberately the same shape as
// lib/theme/backdropPool.ts — read the reasoning there; the two constraints that matter are
// repeated below because they are the ones a future change is tempted to break.
//
// 1. **Reading never blocks site creation.** gpt-image-1 takes ~20s. A new site only ever READS
//    the pool; an empty pool means the hero keeps whatever image it already had. A visitor never
//    waits on generation, and a vertical with no pool yet is exactly as good as it is today.
//
// 2. **Filling is flag-gated and hard-capped** (`HERO_POOL_ENABLED`, `POOL_TARGET`). An industry
//    can never generate more than the cap in total, so worst-case spend is knowable in advance
//    rather than scaling with traffic — which matters because guest-build lets anonymous
//    visitors create sites.
//
// ⚠️ SHARING IS THE POINT, NOT A COMPROMISE. Two lemonade stands in different towns showing the
// same painted pitcher is fine: they differ by name, accent, copy, menu and layout. Guaranteeing
// a unique hero per site means generating per site, which is the unbounded cost this exists to
// avoid. If uniqueness ever matters for a vertical, that vertical wants photographs of the real
// business, not a bigger pool.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { paintHeroPoolImage } from '@/lib/images/paintHero';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'templates';

/** Images per industry. 12 × ~$0.04 ≈ $0.50 per industry, one-time. */
export const HERO_POOL_TARGET = Number(process.env.HERO_POOL_TARGET || 12);

/** Master switch. OFF means: pools are never filled and never read. */
export function heroPoolEnabled(): boolean {
  const v = process.env.HERO_POOL_ENABLED;
  return v === '1' || v === 'true';
}

/**
 * The verticals that default to a painterly hero.
 *
 * These are the ones with no real photograph to use: a family's lemonade stand and a weekend
 * yard sale have no press kit, and a listing-imported storefront photo is not ours to place.
 * A restaurant is deliberately NOT here — a painted dish beside a real menu implies food the
 * kitchen may not serve, which is the invented-menu failure wearing a nicer coat.
 */
export const PAINTERLY_HERO_INDUSTRIES = new Set(['lemonade_stand', 'garage_sale', 'yard_sale', 'thrift_shop']);

export function prefersPainterlyHero(industryKey?: string | null): boolean {
  return !!industryKey && PAINTERLY_HERO_INDUSTRIES.has(industryKey);
}

export function heroPoolPrefix(industryKey: string): string {
  return `heroes/pool/${industryKey.replace(/[^a-z0-9_-]/gi, '')}`;
}

/** Public URLs currently in an industry's hero pool. Empty on any error — never throws. */
export async function listHeroPool(industryKey: string): Promise<string[]> {
  try {
    const prefix = heroPoolPrefix(industryKey);
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(prefix, { limit: 100 });
    if (error || !data) return [];
    return data
      // Both extensions: pool members are .webp since compressForWeb landed, and any .png
      // written before that is still a perfectly good image.
      .filter((f) => /\.(png|webp)$/i.test(f.name))
      .map((f) => supabaseAdmin.storage.from(BUCKET).getPublicUrl(`${prefix}/${f.name}`).data?.publicUrl)
      .filter((u): u is string => !!u);
  } catch {
    return [];
  }
}

/** Pick a random pooled hero, or null to leave the hero exactly as it is. */
export async function pickPoolHero(industryKey?: string | null): Promise<string | null> {
  if (!heroPoolEnabled() || !industryKey) return null;
  const urls = await listHeroPool(industryKey);
  if (!urls.length) return null;
  return urls[Math.floor(Math.random() * urls.length)] ?? null;
}

export type HeroPoolFillResult = {
  industryKey: string;
  before: number;
  added: number;
  full: boolean;
  reason?: string;
};

/**
 * Top an industry's hero pool up by at most `max` images. Called by an admin action or cron,
 * never by a request path. Stops at HERO_POOL_TARGET — the cap is the cost-safety argument.
 */
export async function fillHeroPool(
  industryKey: string,
  max = 1,
  actorId: string | null = null,
): Promise<HeroPoolFillResult> {
  if (!heroPoolEnabled()) {
    return { industryKey, before: 0, added: 0, full: false, reason: 'disabled' };
  }

  const existing = await listHeroPool(industryKey);
  const before = existing.length;
  if (before >= HERO_POOL_TARGET) {
    return { industryKey, before, added: 0, full: true, reason: 'already_full' };
  }

  const room = HERO_POOL_TARGET - before;
  const want = Math.max(0, Math.min(max, room));
  let added = 0;

  for (let i = 0; i < want; i++) {
    // Index by current count so paths stay deterministic and a partial run resumes cleanly.
    const idx = before + added;
    // paintHeroPoolImage swaps the extension for whatever it actually wrote.
    const path = `${heroPoolPrefix(industryKey)}/${String(idx).padStart(3, '0')}.png`;
    const ok = await paintHeroPoolImage(industryKey, path, actorId);
    if (!ok) break; // stop on first failure rather than burning budget retrying
    added++;
  }

  return { industryKey, before, added, full: before + added >= HERO_POOL_TARGET };
}
