// lib/mascot/config.ts
//
// "Say Dog" mascot config. The homepage dog (components/puppy-widget.tsx) generalized into a
// toggle-able per-site feature: a friendly video mascot pinned bottom-right that, when tapped,
// pops a speech bubble. The bubble's content comes from one of three sources:
//   - 'features'  — QuickSites feature highlights (our homepage default).
//   - 'quote'     — HiveJournal's daily inspirational quote (contract quote-of-the-day.md, LIVE;
//                   fetched via our /api/mascot/quote proxy so the site id rides as `ref`).
//   - 'facts'     — random facts about the business (owner-entered; falls back to the site's
//                   services when none are given).

export type MascotSource = 'features' | 'quote' | 'facts';

export type MascotConfig = {
  enabled: boolean;
  source: MascotSource;
  /** For source:'facts' — owner-entered lines the dog rotates through. */
  facts?: string[];
  /** Optional intro label above the bubble text (default varies by source). */
  title?: string;
};

export const MASCOT_SOURCES: { key: MascotSource; label: string; description: string }[] = [
  {
    key: 'facts',
    label: 'Facts about your business',
    description: 'Tap the dog to see a random fact you write below.',
  },
  {
    key: 'quote',
    label: 'Daily inspirational quote',
    description: 'A fresh quote each day, shared across the network.',
  },
  {
    key: 'features',
    label: 'QuickSites features',
    description: 'The default — highlights what the builder can do.',
  },
];

export const DEFAULT_FEATURES = [
  '🚀 AI-generated websites in seconds',
  '🧠 Built-in SEO optimization',
  '📱 Mobile-ready, always',
  '🎨 Fully customizable designs',
  '🔒 Secure & privacy-respecting',
];

/** Read a template's mascot config off meta.mascot (public-render side). */
export function mascotFromMeta(meta: any): MascotConfig | null {
  const m = meta?.mascot;
  if (!m || typeof m !== 'object' || !m.enabled) return null;
  const source: MascotSource = ['features', 'quote', 'facts'].includes(m.source)
    ? m.source
    : 'facts';
  const facts = Array.isArray(m.facts)
    ? m.facts
        .map((f: any) => String(f).trim())
        .filter(Boolean)
        .slice(0, 30)
    : [];
  return { enabled: true, source, facts, title: typeof m.title === 'string' ? m.title : undefined };
}

/**
 * Resolve the messages the dog should rotate through for a given config, given the site's
 * services (used as the fact fallback). For source:'quote' this returns [] — the widget fetches
 * the live quote itself (it changes daily and shouldn't be baked in).
 */
export function resolveMascotMessages(
  cfg: MascotConfig,
  opts: { services?: string[]; businessName?: string } = {}
): string[] {
  if (cfg.source === 'features') return DEFAULT_FEATURES;
  if (cfg.source === 'quote') return [];
  // facts
  const own = (cfg.facts || []).filter(Boolean);
  if (own.length) return own;
  // Fallback: turn the site's services into gentle "did you know" facts.
  const svc = (opts.services || []).filter(Boolean).slice(0, 8);
  const who = opts.businessName ? `${opts.businessName} ` : 'We ';
  return svc.length ? svc.map((s) => `${who}offer ${String(s).toLowerCase()}.`) : [];
}
