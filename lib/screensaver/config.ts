// lib/screensaver/config.ts
//
// Screensaver config + presets. A screensaver is an ambient full-screen image/video that fades
// in after a stretch of no input and dissolves on the next interaction — a "wow-factor" a site
// owner can enable so a visitor who steps away and comes back gets a pleasant surprise. Ported
// from HiveJournal's fireplace screensaver (assets + code cleared for reuse, crosstalk
// 2026-07-18) and generalized to any asset.
//
// Used two ways:
//   1) Per-site service — the owner enables it on their published site (meta.screensaver).
//   2) Our own surfaces — the marketing home + admin shell mount a default one.

export type ScreensaverAssetType = 'video' | 'image';

/** A built-in asset the owner can pick without uploading anything. */
export type ScreensaverPreset = 'fireplace' | 'loader' | 'custom';

export type ScreensaverConfig = {
  enabled: boolean;
  preset: ScreensaverPreset;
  /** For preset:'custom' — the owner's chosen image/video URL. */
  assetUrl?: string;
  assetType?: ScreensaverAssetType;
  /** Idle seconds before it appears (default 120). */
  idleSeconds?: number;
  /** Optional caption shown faintly at the bottom (default "Move or tap to resume"). */
  caption?: string;
};

export type ResolvedScreensaver = {
  enabled: boolean;
  assetType: ScreensaverAssetType;
  /** The concrete URL to render. For the fireplace preset this is time-of-day resolved. */
  assetUrl: string;
  idleMs: number;
  caption: string;
};

export const SCREENSAVER_PRESETS: {
  key: ScreensaverPreset;
  label: string;
  description: string;
}[] = [
  { key: 'fireplace', label: 'Fireplace', description: 'A cozy fire (switches to a darker loop after sunset).' },
  { key: 'loader', label: 'QuickSites motif', description: 'The neon-steampunk QuickSites loop.' },
  { key: 'custom', label: 'Your own image or video', description: 'Paste an image or MP4 URL to use anything you like.' },
];

// Bundled assets (public/). Fireplace day/night are HiveJournal's, cleared for QS use.
const FIREPLACE_DAY = '/brand/screensaver/fireplace-day.mp4';
const FIREPLACE_NIGHT = '/brand/screensaver/fireplace-night.mp4';
const QS_LOADER = '/brand/qs-loader.mp4';

/** Rough "after sunset" heuristic (local time) — mirrors HJ's fireplace day/night swap. */
function isAfterSunset(hour = new Date().getHours()): boolean {
  return hour >= 18 || hour < 6;
}

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url);

/**
 * Resolve a (possibly partial) config into concrete render inputs. Returns `enabled:false` when
 * it shouldn't show. `hour` is injectable for tests / SSR determinism.
 */
export function resolveScreensaver(cfg: ScreensaverConfig | null | undefined, hour?: number): ResolvedScreensaver {
  const off: ResolvedScreensaver = { enabled: false, assetType: 'video', assetUrl: '', idleMs: 120_000, caption: '' };
  if (!cfg || !cfg.enabled) return off;

  const idleMs = Math.max(15, Math.min(3600, Math.round(cfg.idleSeconds || 120))) * 1000;
  const caption = (cfg.caption || 'Move or tap to resume').slice(0, 80);

  if (cfg.preset === 'fireplace') {
    const afterSunset = hour !== undefined ? isAfterSunset(hour) : isAfterSunset();
    return { enabled: true, assetType: 'video', assetUrl: afterSunset ? FIREPLACE_NIGHT : FIREPLACE_DAY, idleMs, caption };
  }
  if (cfg.preset === 'loader') {
    return { enabled: true, assetType: 'video', assetUrl: QS_LOADER, idleMs, caption };
  }
  // custom
  const url = (cfg.assetUrl || '').trim();
  if (!url) return off;
  const assetType: ScreensaverAssetType = cfg.assetType || (isImageUrl(url) ? 'image' : 'video');
  return { enabled: true, assetType, assetUrl: url, idleMs, caption };
}

/** Read a template's screensaver config off meta.screensaver (public-render side). */
export function screensaverFromMeta(meta: any): ScreensaverConfig | null {
  const s = meta?.screensaver;
  if (!s || typeof s !== 'object' || !s.enabled) return null;
  return {
    enabled: true,
    preset: (['fireplace', 'loader', 'custom'].includes(s.preset) ? s.preset : 'fireplace') as ScreensaverPreset,
    assetUrl: typeof s.assetUrl === 'string' ? s.assetUrl : undefined,
    assetType: s.assetType === 'image' || s.assetType === 'video' ? s.assetType : undefined,
    idleSeconds: Number.isFinite(Number(s.idleSeconds)) ? Number(s.idleSeconds) : undefined,
    caption: typeof s.caption === 'string' ? s.caption : undefined,
  };
}
