// ✅ FILE: components/admin/AppHeader.tsx

'use client';

import { useRouter } from 'next/router';
import md5 from 'blueimp-md5';
import Image from 'next/image';
import SafeLink from './ui/SafeLink';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Role } from '@/admin/utils/roles';
import { resolveAdminPath } from '@/lib/resolveAdminPath';
import { useEffect } from 'react';

export default function AppHeader() {
  const { user, role, roleSource, hasRole, ready } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    console.debug('[🧭 AppHeader Role Info]', {
      email: user?.email,
      role,
      source: roleSource,
    });
  }, [user, role, roleSource]);

  const logout = async () => {
    const { supabase } = await import('@/admin/lib/supabaseClient');
    await supabase.auth.signOut();
    if (user?.email) {
      localStorage.removeItem(`cached-role-${user.email}`);
    }
    router.replace('/login');
    setTimeout(() => window.location.reload(), 200);
  };

  const roleBadge = () => {
    if (!role) return null;
    const color =
      role === 'admin'
        ? 'bg-red-500'
        : role === 'owner'
        ? 'bg-yellow-400'
        : role === 'reseller'
        ? 'bg-purple-500'
        : 'bg-gray-500';
    return (
      <span
        className={`text-white text-xs px-2 py-0.5 rounded ${color}`}
        title={`role: ${role} (from: ${roleSource})\ncolors: red=admin, yellow=owner, purple=reseller`}
      >
        {role.toUpperCase()}
      </span>
    );
  };

  const email = user?.email;

  if (!ready) return null;

  return (
    <header className="flex justify-between items-center px-4 py-2 border-b border-zinc-700">
      <div className="text-sm text-blue-400">
        <a href="/docs/diffs" className="hover:underline">📝 Sitemap Diffs</a>
      </div>
      <div className="bg-gray-800 text-white border-b border-gray-700 px-4 py-3 sticky top-0 z-50">
        <div className="flex justify-between items-center">
          <div className="overflow-x-auto whitespace-nowrap max-w-full flex-1">
            {user && (
              <nav className="flex items-center space-x-4 flex-wrap">
                <Image src="/logo.png" alt="Logo" width={28} height={28} className="rounded-sm" />
                <SafeLink href="/dashboard" className="hover:underline" title="Main admin overview">Dashboard</SafeLink><span className="text-gray-500">|</span>
                {hasRole?.(['reseller', 'admin', 'owner'] as Role[]) && (
                  <>
                    <SafeLink href="/admin/sites" className="hover:underline text-green-300" title="Manage all claimed domains">Sites</SafeLink>
                    <SafeLink href="/admin/branding" className="hover:underline text-green-300" title="Customize visual theme options">Themes</SafeLink>
                    <SafeLink href="/admin/docs" className="hover:underline text-green-300" title="Documentation and guides">Docs</SafeLink>
                    <SafeLink href="/admin/branding/import" className="hover:underline text-green-300" title="Import themes or designs">Import</SafeLink>
                    <SafeLink href="/admin/query-usecases" className="hover:underline text-green-300" title="Query param testing tools">Param Usecases</SafeLink>
                    <SafeLink href="/admin/shared/xyz" className="hover:underline text-green-300" title="Shareable preview">Share Demo</SafeLink>
                    <SafeLink href="/admin/branding/og-editor/xyz" className="hover:underline text-green-300" title="Open Graph image editor">OG Editor</SafeLink><span className="text-gray-500">|</span>
                  </>
                )}
                <SafeLink href="/sites" className="hover:underline text-green-300">Public Sites</SafeLink>
                <SafeLink href="/register" className="hover:underline">Register</SafeLink><span className="text-gray-500">|</span>
                {hasRole?.(['reseller', 'admin', 'owner'] as Role[]) && (
                  <>
                    <SafeLink href="/leads" className="hover:underline" title="Lead tracker & CRM">Leads</SafeLink>
                    <SafeLink href="/campaigns" className="hover:underline" title="Active domain offers">Campaigns</SafeLink>
                    <SafeLink href="/queue" className="hover:underline">Queue</SafeLink>
                    <SafeLink href="/logs" className="hover:underline">Logs</SafeLink>
                    <SafeLink href="/admin/logs/sessions" className="hover:underline" title="Track login and device activity">Session Logs</SafeLink>
                    <SafeLink href="/analytics" className="hover:underline">Analytics</SafeLink>
                    <SafeLink href="/heatmap" className="hover:underline">Heatmap</SafeLink>
                    <SafeLink href="/admin/the-grid" className="hover:underline">The Grid</SafeLink>
                    <SafeLink href="/users" className="hover:underline">Users</SafeLink><span className="text-gray-500">|</span>
                  </>
                )}
                {hasRole?.(['admin', 'owner'] as Role[]) && (
                  <>
                    <SafeLink href="/admin/templates" className="hover:underline text-yellow-300" title="Full template list">Templates</SafeLink>
                    <SafeLink href="/admin/zod-playground" className="hover:underline" title="Test parameter schemas">Zod Playground</SafeLink>
                    <SafeLink href="/admin/links" className="hover:underline">Schema Links</SafeLink>
                    <SafeLink href="/admin/embed-views" className="hover:underline">Embed Views</SafeLink>
                    <SafeLink href="/admin/email-summary" className="hover:underline">Email Summary</SafeLink>
                    <SafeLink href="/admin/logs-export" className="hover:underline">Log Exports</SafeLink><span className="text-gray-500">|</span>
                  </>
                )}
                {hasRole?.(['admin', 'reseller'] as Role[]) && (
                  <SafeLink href="/admin/templates-new" className="hover:underline text-yellow-300">+ New Template</SafeLink>
                )}
                {hasRole(['admin'] as Role[]) && (
                  <SafeLink href="/admin/roles" className="hover:underline">Role Manager</SafeLink>
                )}
              </nav>
            )}
          </div>

          {user ? (
            <div className="flex items-center space-x-4 ml-4">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {roleBadge()}
                {(!role && ready) && (
                  <span title="No role detected" className="text-xs text-red-400">⚠️</span>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-white">
                    <img
                      src={user?.user_metadata?.avatar_url || `https://gravatar.com/avatar/${user?.email ? md5(user.email.trim().toLowerCase()) : 'unknown'}?d=identicon`}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <SafeLink href="/profile" className="hover:underline">{email}</SafeLink>
                </div>
              </div>
              <button onClick={logout} className="text-sm text-red-400 hover:underline">
                Log Out
              </button>
            </div>
          ) : (
            <div className="ml-4 text-xs text-gray-500">
              <SafeLink href="/login" className="text-blue-400 hover:underline">Sign In</SafeLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
