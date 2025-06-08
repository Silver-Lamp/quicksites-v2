// ✅ FILE: components/admin/AppHeader.tsx

import { useRouter } from 'next/router';
import md5 from 'blueimp-md5';
import Image from 'next/image';
import SafeLink from './ui/SafeLink';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Role } from '@/admin/utils/roles';
import { resolveAdminPath } from '@/lib/resolveAdminPath';

export default function AppHeader() {
  const { email, role, roleBadge, hasRole, user } = useCurrentUser();
  const router = useRouter();

  const logout = async () => {
    const { supabase } = await import('@/admin/lib/supabaseClient');
    await supabase.auth.signOut();
    router.replace('/login');
    setTimeout(() => window.location.reload(), 200);
  };
  
  
  return (
    <header className="flex justify-between items-center px-4 py-2 border-b border-zinc-700">
      <div className="text-sm text-blue-400">
        <a href="/docs/diffs" className="hover:underline">📝 Sitemap Diffs</a>
      </div>
      <div className="bg-gray-800 text-white border-b border-gray-700 px-4 py-3 sticky top-0 z-50">
        <div className="flex justify-between items-center">
          <div className="overflow-x-auto whitespace-nowrap max-w-full flex-1">
            <nav className="flex items-center space-x-4 flex-wrap">
              <Image src="/logo.png" alt="Logo" width={28} height={28} className="rounded-sm" />
              <SafeLink href="/dashboard" className="hover:underline">Dashboard</SafeLink>
              <SafeLink href={resolveAdminPath('/sites')} className="hover:underline text-green-300">Sites</SafeLink>
              <SafeLink href={resolveAdminPath('/branding')} className="hover:underline text-green-300">Themes</SafeLink>
              <details className="ml-2">
  <summary className="cursor-pointer text-green-300">Docs & Tools</summary>
  <div className="flex flex-col space-y-1 mt-2 ml-2">
    <SafeLink href={resolveAdminPath('/docs')} className="hover:underline">Docs</SafeLink>
    <SafeLink href={resolveAdminPath('/branding/import')} className="hover:underline">Import</SafeLink>
    <SafeLink href={resolveAdminPath('/query-usecases')} className="hover:underline">Param Usecases</SafeLink>
    <SafeLink href={resolveAdminPath('/shared/xyz')} className="hover:underline">Share Demo</SafeLink>
    <SafeLink href={resolveAdminPath('/branding/og-editor/xyz')} className="hover:underline">OG Editor</SafeLink>
  </div>
</details>
              <SafeLink href="/sites" className="hover:underline text-green-300">Public Sites</SafeLink>
              <SafeLink href="/register" className="hover:underline">Register</SafeLink>
              <details className="ml-2">
  <summary className="cursor-pointer text-blue-400">Tools</summary>
  <div className="flex flex-col space-y-1 mt-2 ml-2">
    <SafeLink href="/leads" className="hover:underline">Leads</SafeLink>
    <SafeLink href="/campaigns" className="hover:underline">Campaigns</SafeLink>
    <SafeLink href="/queue" className="hover:underline">Queue</SafeLink>
    <SafeLink href="/logs" className="hover:underline">Logs</SafeLink>
    <details className="ml-2">
    <summary className="cursor-pointer text-blue-400">Insights</summary>
    <div className="flex flex-col space-y-1 mt-2 ml-2">
      <SafeLink href="/analytics" className="hover:underline">Analytics</SafeLink>
      <SafeLink href="/heatmap" className="hover:underline">Heatmap</SafeLink>
    </div>
  </details>
    <SafeLink href={resolveAdminPath('/the-grid')} className="hover:underline">The Grid</SafeLink>
    <SafeLink href="/users" className="hover:underline">Users</SafeLink>
  </div>
</details>

              {hasRole(['admin', 'owner'] as Role[]) && (
                <>
                  <SafeLink href={resolveAdminPath('/templates')} className="hover:underline text-yellow-300">Templates</SafeLink>
                  
                  
                  
                  
                  
                </>
              )}

              {hasRole(['admin', 'owner'] as Role[]) && (
                <SafeLink href={resolveAdminPath('/templates-new')} className="hover:underline text-yellow-300">
                  + New Template
                </SafeLink>
              )}
              {hasRole(['admin', 'owner'] as Role[]) && (
              <details className="ml-2">
                <summary className="cursor-pointer text-yellow-300">More</summary>
                <div className="flex flex-col space-y-1 mt-2 ml-2">
                  <SafeLink href={resolveAdminPath('/zod-playground')} className="hover:underline">
                    Zod Playground
                  </SafeLink>
                  <SafeLink href={resolveAdminPath('/links')} className="hover:underline">
                    Schema Links
                  </SafeLink>
                  <SafeLink href={resolveAdminPath('/embed-views')} className="hover:underline">
                    Embed Views
                  </SafeLink>
                  <SafeLink href={resolveAdminPath('/email-summary')} className="hover:underline">
                    Email Summary
                  </SafeLink>
                  <SafeLink href={resolveAdminPath('/logs-export')} className="hover:underline">
                    Log Exports
                  </SafeLink>
                </div>
              </details>
            )}
          </nav>
          </div>

          <div className="flex items-center space-x-4 ml-4">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {roleBadge()}
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
        </div>
      </div>
    </header>
  );
}
