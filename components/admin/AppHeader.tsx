import { useRouter } from 'next/router';
import md5 from 'blueimp-md5';
import Image from 'next/image';
import SafeLink from './ui/SafeLink';
import { useCurrentUser } from '@/admin/hooks/useCurrentUser';
import { Role } from '@/admin/utils/roles';

export default function AppHeader() {
  const { email, role, roleBadge, hasRole, isViewerOnly, user } = useCurrentUser();
  const router = useRouter();

  const logout = async () => {
    const { supabase } = await import('@/admin/lib/supabaseClient');
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="flex justify-between items-center px-4 py-2 border-b border-zinc-700">
      <div className="text-sm text-blue-400">
        <a href="/docs/diffs" className="hover:underline">📝 Sitemap Diffs</a>
      </div>
 className="bg-gray-800 text-white border-b border-gray-700 px-4 py-3 sticky top-0 z-50">
      <div className="flex justify-between items-center">
        <div className="overflow-x-auto whitespace-nowrap max-w-full flex-1">
          <nav className="flex items-center space-x-4">
            <Image src="/logo.png" alt="Logo" width={28} height={28} className="rounded-sm" />
            <SafeLink href="/dashboard" className="hover:underline">Dashboard</SafeLink>
            <SafeLink href="/admin/sites" className="hover:underline text-green-300">Sites</SafeLink>
            <SafeLink href="/admin/branding" className="hover:underline text-green-300">Themes</SafeLink>
            {isViewerOnly && (
              <SafeLink href="/gallery" className="hover:underline text-green-300">Gallery</SafeLink>
            )}
            <SafeLink href="/admin/docs" className="hover:underline text-green-300">Docs</SafeLink>
            <SafeLink href="/admin/branding/import" className="hover:underline text-green-300">Import</SafeLink>
            <SafeLink href="/admin/query-usecases" className="hover:underline text-green-300">Param Usecases</SafeLink>
            <SafeLink href="/admin/shared/xyz" className="hover:underline text-green-300">Share Demo</SafeLink>
            <SafeLink href="/admin/branding/og-editor/xyz" className="hover:underline text-green-300">OG Editor</SafeLink>
            <SafeLink href="/sites" className="hover:underline text-green-300">Public Sites</SafeLink>
            <SafeLink href="/register" className="hover:underline">Register</SafeLink>
            <SafeLink href="/leads" className="hover:underline">Leads</SafeLink>
            <SafeLink href="/campaigns" className="hover:underline">Campaigns</SafeLink>
            <SafeLink href="/queue" className="hover:underline">Queue</SafeLink>
            <SafeLink href="/logs" className="hover:underline">Logs</SafeLink>
            <SafeLink href="/analytics" className="hover:underline">Analytics</SafeLink>
            <SafeLink href="/heatmap" className="hover:underline">Heatmap</SafeLink>
            <SafeLink href="/the-grid" className="hover:underline">The Grid</SafeLink>
            <SafeLink href="/users" className="hover:underline">Users</SafeLink>

            {hasRole(['admin', 'owner'] as Role[]) && (
              <>
                <SafeLink href="/admin/templates" className="hover:underline text-yellow-300">Templates</SafeLink>
                <SafeLink href="/admin/zod-playground" className="hover:underline">Zod Playground</SafeLink>
                <SafeLink href="/admin/links" className="hover:underline">Schema Links</SafeLink>
                <SafeLink href="/admin/embed-views" className="hover:underline">Embed Views</SafeLink>
                <SafeLink href="/admin/email-summary" className="hover:underline">Email Summary</SafeLink>
                <SafeLink href="/admin/logs-export" className="hover:underline">Log Exports</SafeLink>
              </>
            )}

            <SafeLink href="/admin/templates-new" className="hover:underline text-yellow-300">+ New Template</SafeLink>
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
    </header>
  );
}
