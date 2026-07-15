'use client';

// components/admin/templates/panels/park-address-picker.tsx
//
// "Use an industrial park address" tool. Fills a NAP with a REAL industrial/flex-park
// building (from the parks registry, lazily seeded from Google Places) + a synthetic
// suite. If the city/state are known it fills in one click; otherwise it asks for them.
// "Pick another" re-rolls the park/suite (via a nonce on the seed).

import { useState } from 'react';
import { Factory, Loader2, RefreshCw } from 'lucide-react';
import { cleanCityName } from '@/lib/geo/cleanCityName';

export type PickedParkAddress = {
  line1: string;
  suite: string;
  city: string;
  region: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  label: string;
  parkName: string;
};

type Props = {
  /** Known city/state (from the identity draft). When present, one click fills. */
  city?: string;
  state?: string;
  industryKey?: string | null;
  /** Stable seed for deterministic park/suite choice (e.g. the template id). */
  seed?: string;
  onPick: (addr: PickedParkAddress) => void;
};

export default function ParkAddressPicker({ city, state, industryKey, seed, onPick }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastPark, setLastPark] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [nonce, setNonce] = useState(0);

  const knownCity = (city ?? '').trim();
  const knownState = (state ?? '').trim();

  /** Kick off a Places sweep for this area (discovery), then report how many parks it seeded. */
  async function discover(cityName: string, region: string): Promise<number> {
    try {
      const res = await fetch('/api/admin/parks/prewarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: cityName, region: region || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      return res.ok ? Number(j?.count ?? 0) : 0;
    } catch {
      return 0;
    }
  }

  // `allowDiscover` guards a single auto-sweep + retry so we never loop forever.
  async function pick(useCity: string, useState_: string, n: number, allowDiscover = true) {
    const cityName = cleanCityName(useCity);
    const label = `${cityName}${useState_ ? `, ${useState_}` : ''}`;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/parks/pick-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: cityName,
          region: useState_ || undefined,
          industryKey: industryKey || undefined,
          seed: `${seed || 'identity'}#${n}`,
        }),
      });
      const j = await res.json();
      if (res.ok && j?.ok) {
        setLastPark(j.address.parkName ?? null);
        setAskOpen(false);
        onPick(j.address as PickedParkAddress);
        return;
      }
      // Nothing seeded for this area yet → auto-run discovery once, then retry the pick.
      if (j?.reason === 'no_parks' && allowDiscover && cityName) {
        setMessage(`Discovering industrial parks near ${label}…`);
        const found = await discover(cityName, useState_);
        if (found > 0) {
          await pick(useCity, useState_, n, false); // retry with the freshly-seeded area
          return;
        }
        setMessage(`No industrial parks found near ${label}. Try a nearby larger city.`);
        return;
      }
      setMessage(
        j?.reason === 'disabled'
          ? 'The industrial-park registry is turned off.'
          : j?.reason === 'no_parks'
          ? `No industrial parks found near ${label}.`
          : j?.reason === 'no_city'
          ? 'Enter a city.'
          : j?.error || 'Lookup failed.',
      );
    } catch (e: any) {
      setMessage(e?.message || 'Lookup failed.');
    } finally {
      setBusy(false);
    }
  }

  const onPrimary = () => {
    if (knownCity) {
      const n = nonce + 1;
      setNonce(n);
      pick(knownCity, knownState, n);
    } else {
      setAskOpen((v) => !v);
    }
  };

  const onPickAnother = () => {
    const n = nonce + 1;
    setNonce(n);
    const c = knownCity || cityInput.trim();
    const s = knownState || stateInput.trim();
    if (c) pick(c, s, n);
  };

  const onFind = () => {
    const c = cityInput.trim();
    if (!c) {
      setMessage('Enter a city.');
      return;
    }
    const n = nonce + 1;
    setNonce(n);
    pick(c, stateInput.trim(), n);
  };

  return (
    <div className="rounded-md border border-white/10 bg-neutral-900/40 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrimary}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
          title="Fill this address from a real nearby industrial/flex park (discovers parks automatically if none are cached yet)"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />}
          Use an industrial park address
        </button>
        {lastPark && !askOpen ? (
          <button
            type="button"
            onClick={onPickAnother}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white/80 disabled:opacity-50"
            title="Pick a different park / suite"
          >
            <RefreshCw className="h-3 w-3" />
            Pick another
          </button>
        ) : null}
      </div>

      {/* Ask for city/state when we don't know it */}
      {askOpen && !knownCity ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/50">City</span>
            <input
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Grafton"
              className="w-40 rounded border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-white/90 placeholder-white/30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/50">State</span>
            <input
              value={stateInput}
              onChange={(e) => setStateInput(e.target.value)}
              placeholder="WI"
              maxLength={2}
              className="w-16 rounded border border-white/10 bg-neutral-900 px-2 py-1 text-xs uppercase text-white/90 placeholder-white/30"
            />
          </label>
          <button
            type="button"
            onClick={onFind}
            disabled={busy}
            className="rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Find
          </button>
        </div>
      ) : null}

      {lastPark && !message ? (
        <p className="text-[11px] text-white/45">
          Filled from <span className="text-white/70">{lastPark}</span> — a real building with a placeholder suite. Verify before publishing.
        </p>
      ) : null}
      {message ? <p className="text-[11px] text-amber-300/90">{message}</p> : null}
    </div>
  );
}
