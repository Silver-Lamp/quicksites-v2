'use client';

// app/merchant/audio/page.tsx
//
// "Connect QuickSites" — the owner-facing surface for HiveJournal audio provisioning
// (crosstalk/contracts/partner-provisioning.md). The owner mints a grant token in their
// HJ dashboard ("Connect QuickSites" on an embed), pastes it here, and can then generate
// owner-voice audio (welcome / testimonial) for their site without leaving QuickSites.
//
// Backs onto: GET/POST/DELETE /api/partner/audio/connect + POST /api/partner/audio/generate
// + POST /api/partner/audio/attach (puts the player on the site — no uuid copying).
// Degrades gracefully when provisioning isn't enabled yet (the POST routes 503) — the
// page still explains the flow so it's ready the moment the flag flips.
//
// Voice honesty (consent v2, contract §"Consent v2 — voice bases"): we label a clip with the
// basis HJ reports, never with what we'd like it to be. A narrated review is rendered in the
// NARRATOR voice by contract — a customer's words are never spoken in a cloned voice through
// these rails — so the UI must not blanket-promise "in your voice".

import * as React from 'react';

type Grant = { id: string; hjEmbedId: string; templateId: string | null; billingMode: 'owner' | 'partner' };
type VoiceBasis = 'self' | 'narrator';
type GenResult = { kind: string; audio_url: string; cached: boolean; voiceBasis: VoiceBasis | null } | null;

/** How a rendered clip may be described, given the basis HJ actually used. */
function voiceLabel(basis: VoiceBasis | null): string {
  if (basis === 'self') return 'in your voice';
  if (basis === 'narrator') return 'narrator voice';
  return 'voice not reported';
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const card = 'rounded-xl border border-zinc-800 bg-zinc-900/40 p-5';
const input =
  'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none';
const btn =
  'rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50';

export default function MerchantAudioPage() {
  const [grants, setGrants] = React.useState<Grant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Connect form
  const [embedId, setEmbedId] = React.useState('');
  const [token, setToken] = React.useState('');
  const [templateId, setTemplateId] = React.useState('');
  const [billingMode, setBillingMode] = React.useState<'owner' | 'partner'>('owner');
  const [connecting, setConnecting] = React.useState(false);
  const [connectErr, setConnectErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/partner/audio/connect', { cache: 'no-store' });
      const json = await res.json();
      setGrants(Array.isArray(json?.grants) ? json.grants : []);
    } catch {
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setConnectErr(null);
    setNotice(null);
    if (!UUID_RX.test(embedId.trim())) {
      setConnectErr('The embed ID should look like a uuid (from your HiveJournal dashboard).');
      return;
    }
    if (token.trim().length < 8) {
      setConnectErr('Paste the grant token you copied from HiveJournal.');
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch('/api/partner/audio/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hjEmbedId: embedId.trim(),
          token: token.trim(),
          templateId: templateId.trim() || null,
          billingMode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setConnectErr(
          json?.code === 'disabled'
            ? "Audio provisioning isn't switched on for this account yet — you can still set this up once it is."
            : json?.error || 'Could not connect.',
        );
        return;
      }
      setEmbedId('');
      setToken('');
      setTemplateId('');
      setNotice(
        json?.attached === 'inserted' || json?.attached === 'updated'
          ? 'Connected, and the player is on your site — publish to push it live.'
          : 'Connected. You can generate audio for this embed below.',
      );
      await refresh();
    } catch {
      setConnectErr('Network error — please try again.');
    } finally {
      setConnecting(false);
    }
  }

  async function revoke(hjEmbedId: string) {
    setNotice(null);
    await fetch(`/api/partner/audio/connect?hjEmbedId=${encodeURIComponent(hjEmbedId)}`, { method: 'DELETE' });
    await refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-white">
      <h1 className="text-2xl font-bold tracking-tight">Your voice on your site</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Connect your HiveJournal voice once, then generate owner-voice audio — a spoken welcome, narrated
        testimonials, listing tours — right here. The audio plays on your published site.
      </p>

      {notice && (
        <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {/* How to get a token */}
      <div className={`mt-6 ${card}`}>
        <h2 className="text-base font-semibold">1. Connect QuickSites in HiveJournal</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-400">
          <li>Open your embed in the HiveJournal dashboard and choose <span className="text-zinc-200">Connect QuickSites</span>.</li>
          <li>Generate a connection token — it&rsquo;s shown once. Copy it.</li>
          <li>Paste the embed ID and the token below. Revoke any time from either side.</li>
        </ol>
      </div>

      {/* Connect form */}
      <form onSubmit={connect} className={`mt-4 ${card} space-y-3`}>
        <h2 className="text-base font-semibold">2. Paste your connection</h2>
        <div className="grid gap-1">
          <label className="text-xs text-zinc-400">HiveJournal embed ID</label>
          <input className={input} value={embedId} onChange={(e) => setEmbedId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-zinc-400">Grant token (shown once in HiveJournal)</label>
          <input className={input} value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token you copied" type="password" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-xs text-zinc-400">Site ID (optional)</label>
            <input className={input} value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="Tie to a specific site" />
            <span className="text-[11px] text-zinc-500">Name a site and we&rsquo;ll add the player to it for you.</span>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-400">Billing</label>
            <select className={input} value={billingMode} onChange={(e) => setBillingMode(e.target.value === 'partner' ? 'partner' : 'owner')}>
              <option value="owner">My HiveJournal plan</option>
              <option value="partner">Bundled with my QuickSites plan</option>
            </select>
          </div>
        </div>
        {connectErr && <p className="text-sm text-amber-400">{connectErr}</p>}
        <button className={btn} disabled={connecting} type="submit">
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
      </form>

      {/* Connections + generate */}
      <div className="mt-6">
        <h2 className="text-base font-semibold">3. Your connections</h2>
        {loading ? (
          <p className="mt-2 text-sm text-zinc-500">Loading…</p>
        ) : grants.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No connections yet. Add one above.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {grants.map((g) => (
              <GrantRow key={g.id} grant={g} onRevoke={() => revoke(g.hjEmbedId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GrantRow({ grant, onRevoke }: { grant: Grant; onRevoke: () => void }) {
  const [kind, setKind] = React.useState<'welcome' | 'testimonial'>('welcome');
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<GenResult>(null);

  // "Put the player on a site" — pre-filled with the site this connection is tied to.
  const [siteId, setSiteId] = React.useState(grant.templateId ?? '');
  const [attaching, setAttaching] = React.useState(false);
  const [attachMsg, setAttachMsg] = React.useState<string | null>(null);

  async function attach() {
    setAttachMsg(null);
    if (!siteId.trim()) {
      setAttachMsg('Enter the site ID to add the player to.');
      return;
    }
    setAttaching(true);
    try {
      const res = await fetch('/api/partner/audio/attach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hjEmbedId: grant.hjEmbedId, templateId: siteId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAttachMsg(json?.error || 'Could not add the player.');
        return;
      }
      setAttachMsg(
        json.action === 'inserted'
          ? 'Added the player to that site — publish to push it live.'
          : json.action === 'updated'
            ? 'Pointed that site’s player at this voice — publish to push it live.'
            : 'That site already plays this voice.',
      );
    } catch {
      setAttachMsg('Network error — please try again.');
    } finally {
      setAttaching(false);
    }
  }

  async function generate() {
    setErr(null);
    setResult(null);
    if (!text.trim()) {
      setErr(kind === 'welcome' ? 'Write the greeting to speak.' : 'Paste the review to narrate.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/partner/audio/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hjEmbedId: grant.hjEmbedId,
          kind,
          ...(kind === 'welcome' ? { script: text.trim() } : { quote: text.trim() }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(
          json?.code === 'disabled'
            ? "Audio generation isn't switched on yet."
            : json?.code === 'quota_exceeded'
              ? 'This embed has reached its audio limit.'
              : json?.code === 'voice_third_party'
                ? "That would need someone else's voice, which this connection can't authorize."
                : json?.error || 'Could not generate audio.',
        );
        return;
      }
      setResult({
        kind,
        audio_url: json.audio_url,
        cached: Boolean(json.cached),
        voiceBasis: json.voiceBasis === 'self' || json.voiceBasis === 'narrator' ? json.voiceBasis : null,
      });
    } catch {
      setErr('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-xs text-zinc-300">{grant.hjEmbedId}</div>
          <div className="text-xs text-zinc-500">
            {grant.templateId ? `Site ${grant.templateId.slice(0, 8)}…` : 'All sites'} ·{' '}
            {grant.billingMode === 'partner' ? 'QuickSites-billed' : 'HiveJournal-billed'}
          </div>
        </div>
        <button onClick={onRevoke} className="text-xs text-zinc-400 hover:text-red-400">
          Revoke
        </button>
      </div>

      {/* Last mile: no copying the embed ID into the editor by hand. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
        <span className="text-xs text-zinc-400">Play it on</span>
        <input
          className="w-56 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          placeholder="Site ID"
        />
        <button
          onClick={attach}
          disabled={attaching}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
        >
          {attaching ? 'Adding…' : 'Add player to site'}
        </button>
        {attachMsg && <span className="text-xs text-zinc-400">{attachMsg}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
          value={kind}
          onChange={(e) => setKind(e.target.value === 'testimonial' ? 'testimonial' : 'welcome')}
        >
          <option value="welcome">Spoken welcome</option>
          <option value="testimonial">Narrated review</option>
        </select>
        {/* Per-kind, not a blanket claim: a review is read by the narrator, never cloned. */}
        <span className="text-xs text-zinc-500">
          {kind === 'welcome' ? 'in your voice, if your voice is set up' : 'read by the narrator, not a cloned voice'}
        </span>
      </div>
      <textarea
        className={`mt-2 ${input}`}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={kind === 'welcome' ? 'Hi, I’m so glad you’re here…' : 'Paste a customer review to read aloud'}
      />
      {err && <p className="mt-1 text-xs text-amber-400">{err}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button className={btn} disabled={busy} onClick={generate}>
          {busy ? 'Generating…' : 'Generate audio'}
        </button>
        {result?.audio_url && (
          <span className="text-xs text-zinc-500">
            {result.cached ? 'Reused a cached clip' : 'Fresh render'} · {voiceLabel(result.voiceBasis)}
          </span>
        )}
      </div>
      {result?.audio_url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio className="mt-3 w-full" controls src={result.audio_url} />
      )}
    </div>
  );
}
