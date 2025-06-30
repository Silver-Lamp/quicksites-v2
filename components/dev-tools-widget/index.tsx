// components/dev-tools-widget/index.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useRequestMeta } from '@/hooks/useRequestMeta';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useTheme } from '@/hooks/useGlowTheme';
import type { Database } from '@/types/supabase';
import { DevToolsPanel } from './DevToolsPanel';
import { CookieEditor } from './CookieEditor';
import { HeaderViewer } from './HeaderViewer';
import { SessionViewer } from './SessionViewer';

const devRoles = ['admin', 'owner', 'reseller', 'viewer'];
const testUsers = [
  { email: 'admin@test.com', id: '111-admin-uuid', role: 'admin' },
  { email: 'reseller@test.com', id: '222-reseller-uuid', role: 'reseller' },
  { email: 'viewer@test.com', id: '333-viewer-uuid', role: 'viewer' },
];

if (typeof window !== 'undefined') {
  window.__DEV_MOCK_ROLE__ = null;
  window.__DEV_MOCK_USER__ = null;
}

export default function DevToolsWidget() {
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [cookies, setCookies] = useState<{ [key: string]: string }>({});
  const [headers, setHeaders] = useState<{ [key: string]: string }>({});
  const [layout, setLayout] = useState<'compact' | 'cozy' | 'debug'>('compact');

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
      <DevToolsPanel layout={layout} toggleLayout={toggleLayout} />
      <CookieEditor cookies={cookies} onChange={handleCookieChange} onDelete={handleCookieDelete} />
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
