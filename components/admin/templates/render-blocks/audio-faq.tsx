'use client';

// components/admin/templates/render-blocks/audio-faq.tsx
//
// Audio FAQ — HiveJournal's /ask register (crosstalk/contracts/about-that-embed.md,
// LIVE). Visitor types a question about THIS page; HJ answers strictly from the
// page's own content, in the owner's voice. We build our own UI against the JSON
// (the contract's recommended path — we control layout), so no iframe.
//
//   POST https://www.hivejournal.com/api/about-that/embed/:id/ask
//     { url, question } → { answer, answerable, audio_url }
//   202 { status:'answering' } → another asker holds the claim; re-POST to poll.
//
// Honesty behaviors baked in per contract: answerable:false is a graceful decline
// (shown as the answer, never an error) and we surface the page's own contact
// affordance; audio_url is permanent/unsigned (safe to play inline).

import * as React from 'react';
import type { Block } from '@/types/blocks';

// The /ask API lives on the HJ backend host (same as the studio-demos endpoints),
// NOT www.hivejournal.com (which serves only the loader script + player pages and
// 404s this path). Smoke-verified 2026-07-17; contract host corrected same day.
const ASK_BASE = 'https://hivejournalbackend-production.up.railway.app/api/about-that/embed';
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { block?: Block; content?: Block['content']; previewOnly?: boolean };
type AskResult = { answer: string; answerable: boolean; audio_url: string | null };

export default function RenderAudioFaq({ block, content, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const embedId: string = typeof c.embed_id === 'string' ? c.embed_id.trim() : '';
  const title: string = typeof c.title === 'string' && c.title.trim() ? c.title.trim() : 'Ask about this page';
  const urlOverride: string = typeof c.url === 'string' ? c.url.trim() : '';
  const valid = UUID_RX.test(embedId);

  const [q, setQ] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<AskResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const ask = React.useCallback(async () => {
    const question = q.trim();
    if (!question || busy || !valid || previewOnly) return;
    setBusy(true); setError(null); setResult(null);
    const url = urlOverride || (typeof window !== 'undefined' ? window.location.href.split('#')[0] : '');
    try {
      // 202 = another asker holds the render claim → poll a few times.
      for (let attempt = 0; attempt < 8; attempt++) {
        const res = await fetch(`${ASK_BASE}/${encodeURIComponent(embedId)}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, question }),
        });
        if (res.status === 202) { await new Promise((r) => setTimeout(r, 1200)); continue; }
        const j = await res.json().catch(() => ({}));
        if (res.status === 429) { setError("You've asked a lot just now — give it a minute."); return; }
        if (!res.ok) { setError('Could not get an answer right now.'); return; }
        setResult({ answer: String(j.answer ?? ''), answerable: j.answerable !== false, audio_url: j.audio_url ?? null });
        return;
      }
      setError('Still working on that — try again in a moment.');
    } catch {
      setError('Could not reach the answer service.');
    } finally {
      setBusy(false);
    }
  }, [q, busy, valid, previewOnly, embedId, urlOverride]);

  if (!valid) {
    const inIframe = typeof window !== 'undefined' && window.parent !== window;
    if (!previewOnly && !inIframe) return null; // public site: render nothing until configured
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          💬 <b>Audio FAQ</b> — paste your HiveJournal embed ID (with FAQ enabled) to let visitors ask about this page.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <h3 className="text-base font-semibold">{title}</h3>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); void ask(); }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. What are your hours? Do you offer financing?"
            className="min-w-0 flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy || !q.trim()}
            className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Asking…' : 'Ask'}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-muted-foreground">{error}</p>}

        {result && (
          <div className="mt-4 rounded-xl bg-muted/50 p-4">
            <p className="text-sm leading-relaxed">{result.answer}</p>
            {result.audio_url && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio src={result.audio_url} controls className="mt-3 w-full" />
            )}
            {result.answerable === false && (
              <a href="#contact" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
                Contact us directly →
              </a>
            )}
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground/70">Answers come from this page · powered by HiveJournal</p>
      </div>
    </section>
  );
}
