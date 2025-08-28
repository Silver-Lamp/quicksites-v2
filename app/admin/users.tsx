'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import { supabase } from '@/admin/lib/supabaseClient';

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
  banned_until: string | null;
  user_metadata?: Record<string, any> | null;
  app_metadata?: Record<string, any> | null;
};

type ProfilesMap = Record<string, string>;

const PER_PAGE = 50;

export default function UsersPage() {
  const router = useRouter();
  const { role } = useCanonicalRole();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [profiles, setProfiles] = useState<ProfilesMap>({});
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // controls
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0); // estimate
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'created' | 'lastSignIn'>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResults, setInviteResults] = useState<any[] | null>(null);

  /* ================== gate & load ================== */
  useEffect(() => {
    if (role === null) return;
    if (role !== 'admin') {
      router.push('/login?error=unauthorized');
      return;
    }
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, page]);

  async function load(pageNo: number) {
    try {
      setLoading(true);
      setError('');

      const { data: userList, error: userError } = await supabase.auth.admin.listUsers({
        page: pageNo,
        perPage: PER_PAGE,
      });
      if (userError) throw userError;

      const admins = (userList?.users || []) as any[];
      const mapped: AdminUser[] = admins.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        confirmed_at: u.confirmed_at ?? null,
        banned_until: (u as any).banned_until ?? null,
        user_metadata: u.user_metadata ?? null,
        app_metadata: u.app_metadata ?? null,
      }));
      setUsers(mapped);

      const { data: profileList, error: profErr } = await supabase
        .from('user_profiles')
        .select('user_id, role');
      if (!profErr && profileList) {
        const map: ProfilesMap = {};
        for (const p of profileList) map[p.user_id] = p.role;
        setProfiles(map);
      }

      setTotal(pageNo * PER_PAGE + (mapped.length === PER_PAGE ? PER_PAGE : 0));
    } catch (err: any) {
      console.error('Failed to load users', err);
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  /* ================== actions ================== */
  async function updateRole(userId: string, newRole: string) {
    try {
      await supabase
        .from('user_profiles')
        .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });
      setProfiles((prev) => ({ ...prev, [userId]: newRole }));
    } catch (e) {
      alert('Failed to update role');
    }
  }

  async function disableUser(userId: string) {
    if (!confirm('Disable this user? They will be banned from signing in.')) return;
    const banned_until = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    const { error: err } = await supabase.auth.admin.updateUserById(userId, { user_metadata: { banned_until } });
    if (err) return alert(err.message);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, banned_until } : u)));
  }

  async function enableUser(userId: string) {
    if (!confirm('Re-enable this user?')) return;
    const { error: err } = await supabase.auth.admin.updateUserById(userId, { user_metadata: { banned_until: null } });
    if (err) return alert(err.message);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, banned_until: null } : u)));
  }

  async function deleteUser(userId: string, email?: string | null) {
    if (!confirm(`Delete user${email ? ` ${email}` : ''}? This cannot be undone.`)) return;
    const { error: err } = await supabase.auth.admin.deleteUser(userId);
    if (err) return alert(err.message);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  function copy(text: string, label = 'Copied') {
    navigator.clipboard.writeText(text).then(
      () => console.log(label),
      () => alert('Copy failed')
    );
  }

  function exportCSV() {
    const header = [
      'id',
      'email',
      'role',
      'status',
      'email_verified',
      'last_sign_in_at',
      'created_at',
    ];
    const rows = filteredUsers.map((u) => [
      u.id,
      u.email ?? '',
      profiles[u.id] || 'viewer',
      isBanned(u) ? 'disabled' : 'active',
      u.confirmed_at ? 'yes' : 'no',
      u.last_sign_in_at || '',
      u.created_at,
    ]);
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function escapeCsv(v: string) {
    if (v == null) return '';
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }

  /* ================== derived ================== */
  function isBanned(u: AdminUser) {
    return !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users.slice();

    if (roleFilter !== 'all') {
      list = list.filter((u) => (profiles[u.id] || 'viewer') === roleFilter);
    }

    if (q) {
      list = list.filter((u) => {
        const r = profiles[u.id] || 'viewer';
        const fields = [u.email || '', u.id, r].join(' ').toLowerCase();
        return fields.includes(q);
      });
    }

    list.sort((a, b) => {
      const aVal =
        sortKey === 'created'
          ? new Date(a.created_at).getTime()
          : new Date(a.last_sign_in_at || 0).getTime();
      const bVal =
        sortKey === 'created'
          ? new Date(b.created_at).getTime()
          : new Date(b.last_sign_in_at || 0).getTime();
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return list;
  }, [users, profiles, search, roleFilter, sortKey, sortDir]);

  /* ================== render ================== */
  return (
    <div className="p-6 text-white">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, id, role…"
            className="rounded bg-gray-900 px-3 py-2 text-sm ring-1 ring-gray-700"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded bg-gray-900 px-3 py-2 text-sm ring-1 ring-gray-700"
            title="Filter by role"
          >
            <option value="all">All roles</option>
            <option value="admin">admin</option>
            <option value="reseller">reseller</option>
            <option value="affiliate_referrer">affiliate_referrer</option>
            <option value="viewer">viewer</option>
          </select>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-400">Sort</label>
            <select
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [k, d] = e.target.value.split(':') as any;
                setSortKey(k);
                setSortDir(d);
              }}
              className="rounded bg-gray-900 px-2 py-2 text-sm ring-1 ring-gray-700"
            >
              <option value="created:desc">Created ↓</option>
              <option value="created:asc">Created ↑</option>
              <option value="lastSignIn:desc">Last sign-in ↓</option>
              <option value="lastSignIn:asc">Last sign-in ↑</option>
            </select>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="rounded bg-purple-600 px-3 py-2 text-sm font-medium hover:bg-purple-500"
          >
            Invite
          </button>
          <button
            onClick={exportCSV}
            className="rounded bg-gray-900 px-3 py-2 text-sm ring-1 ring-gray-700 hover:bg-gray-800"
          >
            Export CSV
          </button>
        </div>
      </div>

      {inviteResults && (
        <div className="mb-4 overflow-hidden rounded border border-gray-700">
          <div className="bg-gray-900 px-4 py-2 text-sm text-gray-200">Invite results</div>
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900 text-xs uppercase text-gray-200">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">Link</th>
              </tr>
            </thead>
            <tbody>
              {inviteResults.map((r: any, idx: number) => (
                <tr key={idx} className={idx % 2 ? 'bg-gray-900/50' : 'bg-gray-900/30'}>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        r.status === 'error'
                          ? 'bg-red-900/40 text-red-200 ring-1 ring-red-700'
                          : r.status === 'link'
                          ? 'bg-amber-900/30 text-amber-100 ring-1 ring-amber-700'
                          : 'bg-emerald-900/30 text-emerald-100 ring-1 ring-emerald-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">{r.message || '—'}</td>
                  <td className="px-3 py-2">
                    {r.inviteUrl ? (
                      <button
                        onClick={() => copy(r.inviteUrl, 'Invite link copied')}
                        className="rounded bg-gray-800 px-2 py-1 text-xs ring-1 ring-gray-700 hover:bg-gray-700"
                      >
                        Copy link
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded border border-red-700 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-xs text-gray-400">
        <div>
          Showing <span className="text-gray-200">{filteredUsers.length}</span> of{' '}
          <span className="text-gray-200">{total || page * PER_PAGE}</span> (page {page})
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded bg-gray-900 px-2 py-1 ring-1 ring-gray-700 disabled:opacity-50"
            disabled={page <= 1 || loading}
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded bg-gray-900 px-2 py-1 ring-1 ring-gray-700 disabled:opacity-50"
            disabled={loading || users.length < PER_PAGE}
          >
            Next →
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded border border-gray-700">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="sticky top-0 z-10 bg-gray-800/95 backdrop-blur">
            <tr className="text-xs uppercase tracking-wide text-gray-200">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Email Verified</th>
              <th className="px-4 py-2">Last Sign-In</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-3 text-gray-400" colSpan={7}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              filteredUsers.map((u, i) => {
                const isAlt = i % 2 === 1;
                const r = profiles[u.id] || 'viewer';
                const banned = isBanned(u);
                return (
                  <tr key={u.id} className={isAlt ? 'bg-gray-900/60' : 'bg-gray-900/30'}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-100">{u.email || '—'}</div>
                      <div className="text-[11px] text-gray-500">{u.id}</div>
                    </td>

                    <td className="px-4 py-2">
                      <select
                        value={r}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        className="rounded bg-gray-800 px-2 py-1 text-xs ring-1 ring-gray-700"
                      >
                        <option value="admin">admin</option>
                        <option value="reseller">reseller</option>
                        <option value="affiliate_referrer">affiliate_referrer</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </td>

                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          banned
                            ? 'bg-red-900/40 text-red-200 ring-1 ring-red-700'
                            : 'bg-emerald-900/30 text-emerald-200 ring-1 ring-emerald-700'
                        }`}
                      >
                        {banned ? 'disabled' : 'active'}
                      </span>
                    </td>

                    <td className="px-4 py-2">
                      {u.confirmed_at ? (
                        <span className="rounded bg-emerald-900/30 px-2 py-1 text-xs text-emerald-200 ring-1 ring-emerald-700">
                          yes
                        </span>
                      ) : (
                        <span className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 ring-1 ring-gray-700">
                          no
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2 text-xs text-gray-300">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '—'}
                    </td>

                    <td className="px-4 py-2 text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleString()}
                    </td>

                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {banned ? (
                          <button
                            onClick={() => enableUser(u.id)}
                            className="rounded bg-gray-800 px-2 py-1 text-xs ring-1 ring-gray-700 hover:bg-gray-700"
                          >
                            Enable
                          </button>
                        ) : (
                          <button
                            onClick={() => disableUser(u.id)}
                            className="rounded bg-gray-800 px-2 py-1 text-xs ring-1 ring-gray-700 hover:bg-gray-700"
                          >
                            Disable
                          </button>
                        )}

                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/?ref=${u.id}`;
                            copy(link, 'Referral link copied');
                          }}
                          className="rounded bg-gray-800 px-2 py-1 text-xs ring-1 ring-gray-700 hover:bg-gray-700"
                          title="Copy referral link"
                        >
                          Copy ref link
                        </button>

                        <button
                          onClick={() => copy(u.id, 'User ID copied')}
                          className="rounded bg-gray-800 px-2 py-1 text-xs ring-1 ring-gray-700 hover:bg-gray-700"
                        >
                          Copy ID
                        </button>

                        <button
                          onClick={() => deleteUser(u.id, u.email)}
                          className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-100 ring-1 ring-red-700 hover:bg-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            {!loading && filteredUsers.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-gray-400" colSpan={7}>
                  No users match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* legend */}
      <div className="mt-3 text-xs text-gray-500">
        <div>• <b>Status</b> uses Supabase <code>banned_until</code>. Enable/Disable toggles this value.</div>
        <div>• Referral link copies <code>/?ref=&lt;user_id&gt;</code> for affiliates/resellers.</div>
      </div>

      {/* Invite dialog */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); setInviteResults(null); }}
        onDone={(res) => { setInviteResults(res?.results || null); }}
      />
    </div>
  );
}

/* ================== Invite Dialog ================== */

function InviteDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (payload: any) => void;
}) {
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<'admin' | 'reseller' | 'affiliate_referrer' | 'viewer'>('viewer');
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  if (!open) return null;

  function parseEmails(input: string): string[] {
    return input
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e && /\S+@\S+\.\S+/.test(e));
  }

  async function submit() {
    const list = parseEmails(emails);
    if (!list.length) {
      alert('Enter at least one valid email');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emails: list, role, sendEmail }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Invite failed');
      setResults(j.results || []);
      onDone(j);
    } catch (e: any) {
      alert(e?.message || 'Invite failed');
    } finally {
      setSubmitting(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl rounded-2xl bg-gray-950 p-5 ring-1 ring-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Invite users</h3>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-gray-900"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <label className="text-sm text-gray-300">Emails (comma/space/line separated)</label>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder={`alex@example.com
jamie@example.com, pat@example.com`}
            className="min-h-[120px] w-full rounded bg-gray-900 p-3 text-sm ring-1 ring-gray-800"
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-300">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="rounded bg-gray-900 px-3 py-2 text-sm ring-1 ring-gray-800"
            >
              <option value="viewer">viewer</option>
              <option value="reseller">reseller</option>
              <option value="affiliate_referrer">affiliate_referrer</option>
              <option value="admin">admin</option>
            </select>

            <label className="ml-2 inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              Send email via Resend (if configured)
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded bg-gray-900 px-4 py-2 text-sm ring-1 ring-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Inviting…' : 'Send invites'}
          </button>
        </div>

        {results && (
          <div className="mt-5 overflow-hidden rounded border border-gray-800">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900 text-xs uppercase text-gray-200">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">Invite Link</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => (
                  <tr key={idx} className={idx % 2 ? 'bg-gray-900/50' : 'bg-gray-900/30'}>
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          r.status === 'error'
                            ? 'bg-red-900/40 text-red-200 ring-1 ring-red-700'
                            : r.status === 'link'
                            ? 'bg-amber-900/30 text-amber-100 ring-1 ring-amber-700'
                            : 'bg-emerald-900/30 text-emerald-100 ring-1 ring-emerald-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">{r.message || '—'}</td>
                    <td className="px-3 py-2">
                      {r.inviteUrl ? (
                        <button
                          onClick={() => copy(r.inviteUrl)}
                          className="rounded bg-gray-800 px-2 py-1 text-xs ring-1 ring-gray-700 hover:bg-gray-700"
                        >
                          Copy link
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
