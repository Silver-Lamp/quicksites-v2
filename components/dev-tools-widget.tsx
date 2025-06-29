"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { GlowConfig, useTheme } from "@/hooks/useGlowTheme";

const devRoles = ["admin", "owner", "reseller", "viewer"];
const testUsers = [
  { email: "admin@test.com", id: "111-admin-uuid", role: "admin" },
  { email: "reseller@test.com", id: "222-reseller-uuid", role: "reseller" },
  { email: "viewer@test.com", id: "333-viewer-uuid", role: "viewer" },
];

if (typeof window !== 'undefined') {
  window.__DEV_MOCK_ROLE__ = null;
  window.__DEV_MOCK_USER__ = null;
}

export default function DevToolsWidget() {
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mockRole, setMockRole] = useState<string | null>(null);
  const [mockEmail, setMockEmail] = useState<string>('');
  const [mockUserId, setMockUserId] = useState<string>('');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme: glow } = useTheme();
  const router = useRouter();
  const [hostname, setHostname] = useState<string | null>(null);
  const [runtimeMeta, setRuntimeMeta] = useState({
    dynamic: process.env.NEXT_RUNTIME || 'nodejs',
    region: process.env.NEXT_REGION || 'local',
    mode: process.env.NODE_ENV,
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const minimizedFlag = localStorage.getItem("devtools:minimized") === "true";
      setMinimized(minimizedFlag);
      setVisible(true);
      createClientComponentClient<Database>().auth.getSession().then(({ data }) => {
        setSessionInfo(data.session);
      });

      const handler = (e: KeyboardEvent) => {
        if (e.metaKey && e.key === "~") {
          e.preventDefault();
          setVisible((v) => !v);
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    setHostname(typeof window !== 'undefined' ? window.location.hostname : null);

    const stored = localStorage.getItem('mockUser');
    if (stored) {
      try {
        const { email, id, role } = JSON.parse(stored);
        setMockEmail(email);
        setMockUserId(id);
        setMockRole(role);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__DEV_MOCK_ROLE__ = mockRole;
      window.__DEV_MOCK_USER__ = mockEmail && mockUserId
        ? { email: mockEmail, id: mockUserId }
        : null;

      const data = JSON.stringify({ email: mockEmail, id: mockUserId, role: mockRole });
      if (mockEmail && mockUserId && mockRole) {
        localStorage.setItem('mockUser', data);
      } else {
        localStorage.removeItem('mockUser');
      }
    }
  }, [mockRole, mockEmail, mockUserId]);

  const clearMockState = () => {
    setMockRole(null);
    setMockEmail('');
    setMockUserId('');
    localStorage.removeItem('mockUser');
    alert('🧼 Mock state cleared');
  };

  const clearSupabaseCookies = () => {
    document.cookie = "sb-access-token=; Max-Age=0; path=/;";
    document.cookie = "sb-refresh-token=; Max-Age=0; path=/;";
    alert("🧼 Supabase cookies cleared. Reloading...");
    location.reload();
  };

  const copyGlowTheme = async () => {
    if (!glow.length) {
      alert("⚠️ No glow config to copy.");
      return;
    }
    const formatted = glow
      .map((g) => `${g.size}, ${g.intensity} → ${g.colors.join(' → ')}`)
      .join('\n');
    await navigator.clipboard.writeText(formatted);
    alert("✨ Glow config copied to clipboard");
  };

  const goToGlowEditor = () => {
    router.push("/admin/theme-editor?section=glow");
  };

  const effectiveUser = (typeof window !== 'undefined' && (window as any).__DEV_MOCK_USER__)
    || sessionInfo?.user;
  const effectiveRole = mockRole || sessionInfo?.user?.role;

  if (!visible) return null;

  if (minimized) {
    return (
      <button
        onClick={() => {
          setMinimized(false);
          localStorage.setItem("devtools:minimized", "false");
        }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-800 text-white text-xs rounded border border-zinc-700 shadow-md"
      >
        🛠️ DevTools
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-3 text-xs rounded shadow-md border border-zinc-700 backdrop-blur-md w-[380px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-zinc-300 font-mono">[DevTools]</span>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end text-right">
            <span className="text-cyan-400 font-mono">{hostname}</span>
            <span className="text-emerald-400 font-mono">
              {runtimeMeta.mode} · {runtimeMeta.dynamic} · {runtimeMeta.region}
            </span>
          </div>
          <button
            onClick={() => {
              setMinimized(true);
              localStorage.setItem("devtools:minimized", "true");
            }}
            className="bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded text-xs text-white"
          >
            ⤵ Minimize
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {effectiveUser ? (
          <div className="text-zinc-400">
            <div>User: <span className="font-mono">{effectiveUser.email}</span></div>
            <div className="text-[10px] truncate max-w-full">ID: {effectiveUser.id}</div>
            {effectiveRole && (
              <div className="text-green-500 text-xs font-semibold">
                Role: {effectiveRole}
                {mockRole && <span className="ml-1 text-yellow-400">(simulated)</span>}
              </div>
            )}
            <div className="pt-1">
              <label htmlFor="mock-role" className="block text-white/70 mb-1">Mock Role</label>
              <select
                id="mock-role"
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1"
                value={mockRole ?? ''}
                onChange={(e) => setMockRole(e.target.value || null)}
              >
                <option value="">(live)</option>
                {devRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="pt-1">
              <label className="block text-white/70 mb-1">Mock Email</label>
              <input
                type="email"
                placeholder="test@example.com"
                value={mockEmail}
                onChange={(e) => setMockEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="pt-1">
              <label className="block text-white/70 mb-1">Mock User ID</label>
              <input
                type="text"
                placeholder="uuid..."
                value={mockUserId}
                onChange={(e) => setMockUserId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="pt-2 text-right">
              {testUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setMockEmail(u.email);
                    setMockUserId(u.id);
                    setMockRole(u.role);
                  }}
                  className="text-xs bg-zinc-700 hover:bg-zinc-600 rounded px-2 py-1 ml-2"
                >
                  Impersonate {u.role}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-zinc-500">No session</div>
        )}

        <div className="text-zinc-400 pt-1">
          <div className="truncate">Path: <code className="text-white font-mono">{pathname}</code></div>
          {searchParams?.get("slug") && (
            <div className="truncate text-indigo-400">Site: {searchParams.get("slug")}</div>
          )}
        </div>

        {glow && (
          <div className="pt-1 text-xs text-amber-400">
            <div className="font-semibold">Glow Theme</div>
            {Array.isArray(glow) && glow.length > 0 && (
            <div className="space-y-1">
                {glow.map((g: any, i: number) => (
                <div key={i} className="truncate">
                    • {g.size}, {g.intensity} → {g.colors?.join(' → ') ?? ''}
                </div>
                ))}
            </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={copyGlowTheme}
                className="text-amber-300 underline hover:text-amber-200"
              >
                Copy
              </button>
              <button
                onClick={goToGlowEditor}
                className="text-blue-400 underline hover:text-blue-300"
              >
                Edit
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-3">
          <button
            onClick={clearSupabaseCookies}
            className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
          >
            Clear Auth Cookies
          </button>

          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded text-xs"
          >
            Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
        </div>
      </div>
    </div>
  );
}
