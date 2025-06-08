// ✅ FILE: /components/admin/AppHeader.tsx

import { useRouter } from 'next/router';
import md5 from 'blueimp-md5';
import Image from 'next/image';
import SafeLink from './ui/SafeLink';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Role } from '@/admin/utils/roles';

const testUsers: { email: string; role: Role }[] = [
  { email: 'admin@example.com', role: 'admin' },
  { email: 'reseller@example.com', role: 'reseller' },
  { email: 'viewer@example.com', role: 'viewer' },
  { email: 'owner@example.com', role: 'owner' },
];

export default function AppHeader() {
  const { email, role, roleBadge, hasRole, user } = useCurrentUser();
  const router = useRouter();

  const logout = async () => {
    const { supabase } = await import('@/admin/lib/supabaseClient');
    await supabase.auth.signOut();
    router.push('/login');
  };

  const updateRoleAndLog = async (newRole: Role) => {
    const { supabase } = await import('@/admin/lib/supabaseClient');
    const result = await supabase.auth.updateUser({ data: { role: newRole } });
    if (result.error) {
      console.error('[role change] error:', result.error.message);
      return;
    }
    await supabase.from('user_roles').insert({
      user_email: email,
      new_role: newRole,
      changed_at: new Date().toISOString(),
    });
    router.reload();
  };

  if (process.env.NODE_ENV === 'development') {
    if (!hasRole(['admin', 'owner'])) {
      console.warn(`[AppHeader] Role check: User ${email} is missing admin-level access.`);
    }
  }

  return (
    <header className="flex flex-col border-b border-zinc-700 bg-gray-900 text-white">
      <div className="flex justify-between items-center px-4 py-2">
        <div className="text-sm text-blue-400">
          <a href="/docs/diffs" className="hover:underline">
            📝 Sitemap Diffs
          </a>
        </div>

        <div className="flex items-center space-x-4">
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
              <SafeLink href="/profile" className="hover:underline">
                {email}
              </SafeLink>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-red-400 hover:underline">
            Log Out
          </button>
        </div>
      </div>

      {/* Role Debug Bar */}
      <div className="px-4 py-1 text-xs bg-zinc-800 text-yellow-400 border-t border-zinc-700">
        <code>
          Logged in as <strong>{email}</strong> | Role: <strong>{role}</strong>
        </code>
        <div className="mt-1 text-gray-500">
          Available test roles:
          {testUsers.map((u) => (
            <button
              key={u.email}
              onClick={() => updateRoleAndLog(u.role)}
              className="ml-2 px-2 py-0.5 rounded bg-zinc-700 text-white text-xs hover:bg-zinc-600"
            >
              {u.role}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto whitespace-nowrap px-4 py-2 text-sm">
        <nav className="flex items-center space-x-4">
          <Image src="/logo.png" alt="Logo" width={28} height={28} className="rounded-sm" />

          {/* Public or shared links */}
          <SafeLink href="/dashboard">Dashboard</SafeLink>
          <SafeLink href="/admin/sites" className="text-green-300">Sites</SafeLink>
          <SafeLink href="/admin/branding" className="text-green-300">Themes</SafeLink>
          <SafeLink href="/admin/docs" className="text-green-300">Docs</SafeLink>
          <SafeLink href="/admin/branding/import" className="text-green-300">Import</SafeLink>
          <SafeLink href="/admin/query-usecases" className="text-green-300">Param Usecases</SafeLink>
          <SafeLink href="/admin/shared/xyz" className="text-green-300">Share Demo</SafeLink>
          <SafeLink href="/admin/branding/og-editor/xyz" className="text-green-300">OG Editor</SafeLink>
          <SafeLink href="/sites" className="text-green-300">Public Sites</SafeLink>

          {/* Limited access features */}
          {hasRole(['admin', 'owner', 'reseller'] as Role[]) ? (
            <>
              <SafeLink href="/register">Register</SafeLink>
              <SafeLink href="/leads">Leads</SafeLink>
              <SafeLink href="/campaigns">Campaigns</SafeLink>
              <SafeLink href="/queue">Queue</SafeLink>
              <SafeLink href="/logs">Logs</SafeLink>
              <SafeLink href="/analytics">Analytics</SafeLink>
              <SafeLink href="/heatmap">Heatmap</SafeLink>
              <SafeLink href="/the-grid">The Grid</SafeLink>
              <SafeLink href="/users">Users</SafeLink>
            </>
          ) : (
            <span className="text-xs text-gray-500 italic">(access-restricted links hidden)</span>
          )}

          {/* Admin/owner only */}
          {hasRole(['admin', 'owner'] as Role[]) ? (
            <>
              <SafeLink href="/admin/templates" className="text-yellow-300">Templates</SafeLink>
              <SafeLink href="/admin/zod-playground">Zod Playground</SafeLink>
              <SafeLink href="/admin/links">Schema Links</SafeLink>
              <SafeLink href="/admin/embed-views">Embed Views</SafeLink>
              <SafeLink href="/admin/email-summary">Email Summary</SafeLink>
              <SafeLink href="/admin/logs-export">Log Exports</SafeLink>
            </>
          ) : (
            <span className="text-xs text-gray-500 italic">(admin-only links hidden)</span>
          )}

          <SafeLink href="/admin/templates-new" className="text-yellow-300">+ New Template</SafeLink>
        </nav>
      </div>
    </header>
  );
}
