// components/dev-tools-widget/index.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRequestMeta } from '@/hooks/useRequestMeta';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';
import { DevToolsPanel } from './DevToolsPanel';
import { CookieEditor } from './CookieEditor';
import { HeaderViewer } from './HeaderViewer';
import { SessionViewer } from './SessionViewer';
import { useMockGeolocation } from '@/hooks/useMockGeolocation';

export default function DevToolsWidget() {
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [cookies, setCookies] = useState<{ [key: string]: string }>({});
  const [headers, setHeaders] = useState<{ [key: string]: string }>({});
  const [layout, setLayout] = useState<'compact' | 'cozy' | 'debug'>('compact');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  const mockGeo = useMockGeolocation();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const minimizedFlag = localStorage.getItem('devtools:minimized') === 'true';
      setMinimized(minimizedFlag);
      setVisible(true);
      createClientComponentClient<Database>().auth.getSession().then(({ data }) => {
        setSessionInfo(data.session);
      });

      const handler = (e: KeyboardEvent) => {
        if (e.metaKey && e.key === '~') {
          e.preventDefault();
          setVisible((v) => !v);
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, []);

  useEffect(() => {
    const parsed: { [key: string]: string } = {};
    document.cookie.split(';').forEach((c) => {
      const [key, ...rest] = c.trim().split('=');
      parsed[key] = rest.join('=');
    });
    setCookies(parsed);

    const headerDump = (window as any).__NEXT_DATA__?.props?.headers || {};
    setHeaders(headerDump);
  }, []);

  const handleCookieChange = (key: string, value: string) => {
    document.cookie = `${key}=${value}`;
    setCookies((prev) => ({ ...prev, [key]: value }));
  };

  const handleCookieDelete = (key: string) => {
    document.cookie = `${key}=; Max-Age=0`;
    const updated = { ...cookies };
    delete updated[key];
    setCookies(updated);
  };

  const toggleLayout = () => {
    setLayout((prev) =>
      prev === 'compact' ? 'cozy' : prev === 'cozy' ? 'debug' : 'compact'
    );
  };

  const geocodeCity = async () => {
    if (!locationQuery.trim()) return;
    setLocationLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          locationQuery
        )}`
      );
      const data = await response.json();
      if (data?.[0]) {
        const lat = parseFloat(data[0].lat).toFixed(4);
        const lon = parseFloat(data[0].lon).toFixed(4);
        handleCookieChange('mock-geo', `${lat},${lon}`);
      } else {
        alert('Location not found');
      }
    } catch (err) {
      alert('Failed to fetch geolocation');
    } finally {
      setLocationLoading(false);
    }
  };

  if (!visible) return null;

  if (minimized) {
    return (
      <button
        onClick={() => {
          setMinimized(false);
          localStorage.setItem('devtools:minimized', 'false');
        }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-800 text-white text-xs rounded border border-zinc-700 shadow-md"
      >
        🛠️ DevTools
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-3 text-xs rounded shadow-md border border-zinc-700 backdrop-blur-md w-[420px] max-h-[80vh] overflow-y-auto">
      <DevToolsPanel layout={layout} toggleLayout={toggleLayout} minimized={minimized} />
      <CookieEditor cookies={cookies} onChange={handleCookieChange} onDelete={handleCookieDelete} />

      {/* 🌍 Mock Geolocation Editor */}
      <div className="mt-4 p-3 bg-zinc-800 border border-zinc-700 rounded text-xs space-y-2">
        <div className="font-semibold text-white">Mock Geolocation</div>
        <div className="text-zinc-400">Set the <code>mock-geo</code> cookie to simulate user location.</div>
        <input
          type="text"
          placeholder="e.g. 37.7749,-122.4194"
          value={cookies['mock-geo'] || ''}
          onChange={(e) => handleCookieChange('mock-geo', e.target.value)}
          className="w-full mt-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-600 text-white"
        />
        {mockGeo && (
          <div className="text-emerald-400 text-xs">
            Active mock: lat {mockGeo.lat.toFixed(4)}, lon {mockGeo.lon.toFixed(4)}
          </div>
        )}

        {/* 🔍 City-based lookup */}
        <div className="pt-2 space-y-1">
          <label className="text-white">City Lookup</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Seattle, WA"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-600 text-white"
            />
            <button
              onClick={geocodeCity}
              disabled={locationLoading}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs"
            >
              {locationLoading ? '…' : 'Go'}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => handleCookieDelete('mock-geo')}
            className="text-red-400 text-xs underline"
          >
            Clear Location
          </button>
        </div>
      </div>

      <HeaderViewer headers={headers} />
      <SessionViewer sessionInfo={sessionInfo?.session} />

      <div className="text-right">
        <button
          onClick={() => setMinimized(true)}
          className="text-xs text-zinc-400 underline"
        >
          Minimize
        </button>
      </div>
    </div>
  );
}
