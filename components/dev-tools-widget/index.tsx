// app/admin/dev-tools-widget/index.tsx
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
import { supabase } from '@/lib/supabaseClient';

export default function DevToolsWidget() {
  const [visible, setVisible] = useState(true);
  const [minimized, setMinimized] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [cookies, setCookies] = useState<{ [key: string]: string }>({});
  const [headers, setHeaders] = useState<{ [key: string]: string }>({});
  const [locationQuery, setLocationQuery] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [showJwt, setShowJwt] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [jwtPayload, setJwtPayload] = useState<any>(null);

  const mockGeo = useMockGeolocation();
  const meta = useRequestMeta();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    setVisible(true);
    const minimizedFlag = localStorage.getItem('devtools:minimized') === 'true';
    setMinimized(minimizedFlag);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '~') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('devtools:minimized', String(minimized));
  }, [minimized]);

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

  useEffect(() => {
    if (!mockGeo?.lat || !mockGeo?.lon) return;

    const mock = {
      coords: {
        latitude: parseFloat(mockGeo.lat.toString()),
        longitude: parseFloat(mockGeo.lon.toString()),
        accuracy: 10,
      },
      timestamp: Date.now(),
    };

    navigator.geolocation.getCurrentPosition = (cb) => {
      cb(mock as GeolocationPosition);
    };
  }, [mockGeo]);

  useEffect(() => {
    if (!session?.access_token) return;
    try {
      const [, payload] = session.access_token.split('.');
      const decoded = JSON.parse(atob(payload));
      setJwtPayload(decoded);
    } catch (err) {
      console.warn('Failed to decode JWT', err);
    }
  }, [session?.access_token]);

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

  const copyDebugState = () => {
    const debug = {
      meta,
      session,
      cookies,
      headers,
    };
    navigator.clipboard.writeText(JSON.stringify(debug, null, 2));
    alert('Debug state copied!');
  };

  const abVariant = cookies['ab-variant'];
  const sessionId = cookies['session-id'];
  const hasMockUser = Boolean(cookies['mock-user-id']);

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

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-3 text-xs rounded shadow-md border border-zinc-700 backdrop-blur-md w-[420px] max-h-[80vh] overflow-y-auto">
      <DevToolsPanel minimized={minimized} />
      <TopMetadataSummary abVariant={abVariant} sessionId={sessionId} hasMockUser={hasMockUser} />
      <CookieEditor cookies={cookies} onChange={handleCookieChange} onDelete={handleCookieDelete} />
      <MockGeolocationEditor
        cookieValue={cookies['mock-geo'] || ''}
        onChange={handleCookieChange}
        onDelete={() => handleCookieDelete('mock-geo')}
        locationQuery={locationQuery}
        setLocationQuery={setLocationQuery}
        loading={locationLoading}
        setLoading={setLocationLoading}
        activeGeo={mockGeo ? { lat: mockGeo.lat.toString(), lon: mockGeo.lon.toString() } : { lat: '', lon: '' }}
      />
      <MockUserEditor
        cookies={cookies}
        onChange={handleCookieChange}
        onDelete={handleCookieDelete}
      />
      <HeaderViewer headers={headers} />
      <SessionViewer
        sessionInfo={session}
      />
      <div className="flex justify-between items-center pt-3">
        <button
          onClick={() => setMinimized(true)}
          className="text-xs text-zinc-400 underline"
        >
          Minimize
        </button>
        <button
          onClick={copyDebugState}
          className="text-xs text-blue-400 underline"
        >
          📋 Copy Debug Info
        </button>
      </div>
    </div>
  );
}
