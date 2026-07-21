// lib/talkingDemo/types.ts
//
// Talking Demo Tier 2 shared types — the QS side of crosstalk/contracts/talking-demo-render.md.
// QS generates the tour SCRIPT from a site's blocks; HJ renders it to narration audio (+ MP4).

/** One step of a tour script — what QS generates from a block and hands to HJ to narrate. */
export type TourStep = {
  /** Short on-screen label for the step (e.g. "What they offer"). */
  caption: string;
  /** The line HJ narrates. Clamped (~300 chars) — this is what gets voiced. */
  say: string;
  /** Optional silent hold (ms) for steps without much to say. */
  dwell_ms?: number;
};

/** The full tour script QS sends to HJ's render endpoint. */
export type TalkingDemoScript = {
  /** Stable QS site id — HJ's dedupe/cache key (unchanged steps → cache hit → $0). */
  instance_ref: string;
  steps: TourStep[];
  /** owner_clone requires an X-Partner-Grant; defaults to house. */
  voice?: 'house' | 'owner_clone';
  /** false = audio-only (the on-page bar); true = also render the shareable MP4. */
  want_mp4?: boolean;
};

/** A step after HJ has narrated it. */
export type RenderedStep = { caption: string; say: string; audio_url: string };

/** HJ's render response (POST /api/partner/talking-demo/render + poll GET /:instance_id). */
export type TalkingDemoRender = {
  instance_id: string;
  steps: RenderedStep[];
  mp4_status: 'rendering' | 'ready' | 'skipped';
  mp4_url: string | null;
  voice_basis: 'self' | 'narrator';
  usage?: { owner_id?: string; render_chars: number; billed: boolean };
};

// Contract guardrails (talking-demo-render.md §Cost + abuse guards).
export const MAX_STEPS = 24;
export const MAX_SAY_CHARS = 300;
