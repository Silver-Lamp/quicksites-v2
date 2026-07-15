'use client';

// Sender-profile settings for cold outreach — the operator's "who's contacting you" identity.
// Everything here is printed on the postcard (human sign-off: name/title/photo/signature +
// "Questions? {email}") and shown on the claim landing page a prospect reaches after scanning.
// Persists to /api/admin/prospects/sender-profile (site_settings). Replaces the old
// POSTCARD_SENDER_* env vars, which remain a fallback.

import { useState } from 'react';
import SenderImageField from '@/components/admin/media/sender-image-field';

export type SenderProfile = {
  name: string | null;
  title: string | null;
  email: string | null;
  headshotUrl: string | null;
  signatureUrl: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

const EMPTY: SenderProfile = {
  name: '', title: '', email: '', headshotUrl: '', signatureUrl: '', city: '', state: '', lat: null, lng: null,
};

function Field({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-neutral-700 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-sky-500/60 focus:outline-none"
      />
      {hint && <span className="text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

export default function SenderProfileModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: SenderProfile | null;
  onClose: () => void;
  onSaved: (profile: SenderProfile, ready: boolean) => void;
}) {
  const [p, setP] = useState<SenderProfile>({ ...EMPTY, ...(initial ?? {}) });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof SenderProfile) => (v: string) => setP((prev) => ({ ...prev, [k]: v }));

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/prospects/sender-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: p.name || null,
          title: p.title || null,
          email: p.email || null,
          headshotUrl: p.headshotUrl || null,
          signatureUrl: p.signatureUrl || null,
          city: p.city || null,
          state: p.state || null,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Could not save.');
      onSaved(j.profile, j.ready);
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={() => !saving && onClose()}>
      <div className="my-4 w-full max-w-lg rounded-2xl border border-neutral-700 bg-neutral-900 p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Sender profile</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Shown on every postcard and claim page — so prospects know a real person built their site.
            </p>
          </div>
          <button onClick={() => !saving && onClose()} className="rounded-full p-1 text-neutral-500 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Your name" value={p.name ?? ''} onChange={set('name')} placeholder="Sandon Jurowski" />
          <Field label="Title (optional)" value={p.title ?? ''} onChange={set('title')} placeholder="Founder" />
          <div className="sm:col-span-2">
            <Field label="Contact email" type="email" value={p.email ?? ''} onChange={set('email')} placeholder="you@studio.com"
              hint="Printed as “Questions? …” on the card and shown on the claim page." />
          </div>
          <div className="sm:col-span-2">
            <SenderImageField
              label="Headshot"
              kind="headshot"
              round
              value={p.headshotUrl}
              onChange={(url) => setP((prev) => ({ ...prev, headshotUrl: url }))}
              hint="Upload a photo or pick one you've used before — printed on the card."
            />
          </div>
          <div className="sm:col-span-2">
            <SenderImageField
              label="Signature"
              kind="signature"
              value={p.signatureUrl}
              onChange={(url) => setP((prev) => ({ ...prev, signatureUrl: url }))}
              hint="A transparent PNG of your signature works best."
            />
          </div>
        </div>

        <div className="mt-4 border-t border-neutral-800 pt-4">
          <div className="text-xs font-semibold text-neutral-300">Your business location</div>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Powers the “local to me” line — shown only when a prospect is in your state (or within range).
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><Field label="City" value={p.city ?? ''} onChange={set('city')} placeholder="Renton" /></div>
            <Field label="State" value={p.state ?? ''} onChange={(v) => set('state')(v.toUpperCase())} placeholder="WA" />
            <div />
            <Field label="Latitude (optional)" value={p.lat == null ? '' : String(p.lat)} onChange={(v) => setP((prev) => ({ ...prev, lat: v.trim() === '' ? null : Number(v) }))} placeholder="47.48" hint="Enables cross-state radius." />
            <Field label="Longitude (optional)" value={p.lng == null ? '' : String(p.lng)} onChange={(v) => setP((prev) => ({ ...prev, lng: v.trim() === '' ? null : Number(v) }))} placeholder="-122.20" />
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-sky-400 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
