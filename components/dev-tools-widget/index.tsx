// components/dev-tools-widget/index.tsx
'use client';

import { useEffect, useState } from 'react';
import { useMockGeolocation } from '@/hooks/useMockGeolocation';
import { useRequestMeta } from '@/hooks/useRequestMeta';
import type { Session } from '@supabase/supabase-js';
import { DevToolsPanel } from './DevToolsPanel';
import { CookieEditor } from './CookieEditor';
import { HeaderViewer } from './HeaderViewer';
import { SessionViewer } from './SessionViewer';
import { TopMetadataSummary } from './TopMetadataSummary';
import { MockGeolocationEditor } from './MockGeolocationEditor';
import { MockUserEditor } from './MockUserEditor';
// ✅ correct path (matches your client helper)
import { supabase } from '@/lib/supabase/client';

function decodeSupabaseCookieSummary(raw?: string) {
  if (!raw || !raw.startsWith('base64-')) return null;
  try {
    const json = atob(raw.slice('base64-'.length));
    const data = JSON.parse(json);
    // Return a *small* summary so we don't leak tokens in the UI
    return {
      has_access_token: Boolean(data?.access_token),
      has_refresh_token: Boolean(data?.refresh_token),
      expires_at: data?.expires_at ?? null,
      user: data?.user
        ? { id: data.user.id, email: data.user.email }
        : null,
    };
  } catch {
    // Never spam console with parse errors—just return null
    return null;
  }
}

export default function DevToolsWidget() {
  const [visible, setVisible] = useState(true);
  const [minimized, setMinimized] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [cookieMap, setCookieMap] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [locationQuery, setLocationQuery] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [jwtPayload, setJwtPayload] = useState<any>(null);

  const mockGeo = useMockGeolocation();
  const meta = useRequestMeta();

  // Boot loader (dev only), wire auth listener
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    setVisible(true);
    setMinimized(localStorage.getItem('devtools:minimized') === 'true');

    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s ?? null));

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '~') {
        e.preventDefault();
        setVisible(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Persist minimized flag
  useEffect(() => {
    localStorage.setItem('devtools:minimized', String(minimized));
  }, [minimized]);

  // Capture cookies/headers once (no JSON.parse of sb-*!)
  useEffect(() => {
    const map: Record<string, string> = {};
    document.cookie.split(';').forEach((c) => {
      if (!c) return;
      const [key, ...rest] = c.trim().split('=');
      map[key] = rest.join('=');
    });
    setCookieMap(map);

    const headerDump = (window as any).__NEXT_DATA__?.props?.headers || {};
    setHeaders(headerDump);
  }, []);

  // Mock geolocation if set
  useEffect(() => {
    if (!mockGeo?.lat || !mockGeo?.lon) return;
    const mock = {
      coords: {
        latitude: Number(mockGeo.lat),
        longitude: Number(mockGeo.lon),
        accuracy: 10,
      },
      timestamp: Date.now(),
    };
    navigator.geolocation.getCurrentPosition = (cb) => cb(mock as GeolocationPosition);
  }, [mockGeo]);

  // Decode JWT (safe)
  useEffect(() => {
    if (!session?.access_token) {
      setJwtPayload(null);
      return;
    }
    try {
      const [, payload] = session.access_token.split('.');
      setJwtPayload(JSON.parse(atob(payload)));
    } catch {
      setJwtPayload(null);
    }
  }, [session?.access_token]);

  // Cookie mutations (simple; no JSON.parse attempts)
  const handleCookieChange = (key: string, value: string) => {
    document.cookie = `${key}=${value}`;
    setCookieMap(prev => ({ ...prev, [key]: value }));
  };
  const handleCookieDelete = (key: string) => {
    document.cookie = `${key}=; Max-Age=0; path=/`;
    setCookieMap(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const copyDebugState = () => {
    const debug = { meta, session, cookies: cookieMap, headers, jwtPayload };
    navigator.clipboard.writeText(JSON.stringify(debug, null, 2));
    alert('Debug state copied!');
  };

  const abVariant = cookieMap['ab-variant'];
  const sessionId = cookieMap['session-id'];
  const hasMockUser = Boolean(cookieMap['mock-user-id']);

  if (!visible) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-800 text-white text-xs rounded border border-zinc-700 shadow-md"
      >
        🛠️ DevTools
      </button>
    );
  }

  const supaCookieName = Object.keys(cookieMap).find(n => n.startsWith('sb-') && n.endsWith('-auth-token'));
  const supaCookieSummary = decodeSupabaseCookieSummary(supaCookieName ? cookieMap[supaCookieName] : undefined);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-3 text-xs rounded shadow-md border border-zinc-700 backdrop-blur-md w-[420px] max-h-[80vh] overflow-y-auto">
      <DevToolsPanel minimized={minimized} />
      <TopMetadataSummary abVariant={abVariant} sessionId={sessionId} hasMockUser={hasMockUser} />

      {/* Optional, safe summary of the Supabase session cookie */}
      {supaCookieName && (
        <div className="mb-2 rounded border border-zinc-700/60 p-2">
          <div className="mb-1 opacity-70">Supabase cookie: <code>{supaCookieName}</code></div>
          {supaCookieSummary ? (
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(supaCookieSummary, null, 2)}
            </pre>
          ) : (
            <div className="opacity-60">Present (base64), details hidden or could not be decoded.</div>
          )}
        </div>
      )}

      <CookieEditor
        cookies={cookieMap}
        onChange={handleCookieChange}
        onDelete={handleCookieDelete}
      />

      <MockGeolocationEditor
        cookieValue={cookieMap['mock-geo'] || ''}
        onChange={handleCookieChange}
        onDelete={() => handleCookieDelete('mock-geo')}
        locationQuery={locationQuery}
        setLocationQuery={setLocationQuery}
        loading={locationLoading}
        setLoading={setLocationLoading}
        activeGeo={mockGeo ? { lat: String(mockGeo.lat), lon: String(mockGeo.lon) } : { lat: '', lon: '' }}
      />

      <MockUserEditor cookies={cookieMap} onChange={handleCookieChange} onDelete={handleCookieDelete} />

      <HeaderViewer headers={headers} />
      <SessionViewer sessionInfo={session} jwtPayload={jwtPayload} />

      <div className="flex justify-between items-center pt-3">
        <button onClick={() => setMinimized(true)} className="text-xs text-zinc-400 underline">
          Minimize
        </button>
        <button onClick={copyDebugState} className="text-xs text-blue-400 underline">
          📋 Copy Debug Info
        </button>
      </div>
    </div>
  );
}
