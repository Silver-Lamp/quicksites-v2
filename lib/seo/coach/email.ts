// lib/seo/coach/email.ts
//
// Pure HTML builders for the daily "next best step" + weekly summary coaching emails,
// plus the List-Unsubscribe headers. No I/O. v1 uses the default QuickSites brand
// (orgEmailBrand needs a request host, unavailable in a cron). See docs/AI_SEO_COACHING.md.

import type { RecStep, SeoRec, RecSummary } from '@/lib/seo/coach/types';

const escMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (m) => escMap[m]);

function shell(bodyInner: string, unsubscribeUrl: string, manageUrl: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5;color:#111;max-width:560px;margin:0 auto">
    <div style="font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#7c3aed;margin-bottom:12px">QuickSites · SEO Coach</div>
    ${bodyInner}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px" />
    <p style="font-size:12px;color:#888;margin:0">
      You’re getting this because SEO coaching is on for your QuickSites account.
      <a href="${esc(manageUrl)}" style="color:#888">Manage email preferences</a> ·
      <a href="${esc(unsubscribeUrl)}" style="color:#888">Unsubscribe</a>
    </p>
  </div>`;
}

function scoreBadge(score: number, delta?: number): string {
  const color = score >= 75 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626';
  const arrow = delta == null || delta === 0 ? '' : delta > 0 ? ` <span style="color:#059669">▲ ${delta}</span>` : ` <span style="color:#dc2626">▼ ${Math.abs(delta)}</span>`;
  return `<span style="display:inline-block;background:${color}1a;color:${color};font-weight:700;border-radius:8px;padding:4px 10px;font-size:14px">SEO score: ${score}/100${arrow}</span>`;
}

function stepCard(step: RecStep): string {
  return `
  <div style="border:1px solid #ececec;border-radius:12px;padding:16px;margin:12px 0;background:#fafafa">
    <div style="font-size:16px;font-weight:600;margin:0 0 4px">${esc(step.title)}</div>
    ${step.why ? `<div style="font-size:14px;color:#555;margin:0">${esc(step.why)}</div>` : ''}
  </div>`;
}

/** Daily email: one focused next step for a site. */
export function buildDailyCoachEmail(args: {
  siteName: string;
  domain: string | null;
  step: RecStep;
  score: number;
  unsubscribeUrl: string;
  manageUrl: string;
}): { subject: string; html: string } {
  const site = esc(args.siteName || args.domain || 'your site');
  const inner = `
    <h1 style="font-size:20px;margin:0 0 8px">Today’s next best step for ${site}</h1>
    <p style="margin:0 0 14px">${scoreBadge(args.score)}</p>
    ${stepCard(args.step)}
    <p style="font-size:13px;color:#777;margin:12px 0 0">One small improvement a day compounds. Knock this out and we’ll pick the next highest-impact fix tomorrow.</p>`;
  return {
    subject: `Your next SEO step: ${args.step.title}`,
    html: shell(inner, args.unsubscribeUrl, args.manageUrl),
  };
}

/** Weekly email: score + trend + top 3 (LLM summary if present, else deterministic recs). */
export function buildWeeklyCoachEmail(args: {
  siteName: string;
  domain: string | null;
  score: number;
  scoreDelta: number | null;
  summary: RecSummary | null;
  recs: SeoRec[];
  unsubscribeUrl: string;
  manageUrl: string;
}): { subject: string; html: string } {
  const site = esc(args.siteName || args.domain || 'your site');
  const steps: RecStep[] = args.summary?.steps?.length
    ? args.summary.steps
    : args.recs.slice(0, 3).map((r) => ({ title: r.title, why: r.detail }));

  const trendLine =
    args.scoreDelta == null
      ? ''
      : args.scoreDelta > 0
        ? `<p style="margin:0 0 14px;color:#059669">Up ${args.scoreDelta} points since last week — nice work. Keep it going:</p>`
        : args.scoreDelta < 0
          ? `<p style="margin:0 0 14px;color:#b45309">Down ${Math.abs(args.scoreDelta)} points this week. Here’s how to recover:</p>`
          : `<p style="margin:0 0 14px;color:#555">Holding steady. Here’s where to push next:</p>`;

  const inner = `
    <h1 style="font-size:20px;margin:0 0 8px">Your weekly SEO summary — ${site}</h1>
    <p style="margin:0 0 10px">${scoreBadge(args.score, args.scoreDelta ?? undefined)}</p>
    ${trendLine}
    ${steps.map(stepCard).join('')}
    <p style="font-size:13px;color:#777;margin:12px 0 0">Tackle these three this week. We’ll re-score your site and send a fresh plan next Monday.</p>`;
  return {
    subject: `Weekly SEO summary for ${args.siteName || args.domain || 'your site'} (score ${args.score}/100)`,
    html: shell(inner, args.unsubscribeUrl, args.manageUrl),
  };
}

/** RFC-2369 one-click unsubscribe headers to attach to the queued email row. */
export function listUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
