'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';
import { useCurrentUser } from '@/admin/hooks/useCurrentUser';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/admin/ui/input';
import { Button } from '@/components/admin/ui/button';
import { Label } from '@/components/admin/ui/label';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const [latestLog, setLatestLog] = useState<any | null>(null);
  const [showUtc, setShowUtc] = useState(false);
  const [userMetadata, setUserMetadata] = useState<any | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    supabase
      .from('user_deletion_logs')
      .select('id, email, deleted_at, user_id, admin_actor, reason')
      .order('deleted_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.length) setLatestLog(data[0]);
      });

    supabase.auth.getUser().then(({ data }) => {
      setUserMetadata(data.user ?? null);
    });
  }, []);

  const { user } = useCurrentUser();
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '');
  const [displayName, setDisplayName] = useState(user?.user_metadata?.name || '');
  const [bio, setBio] = useState(user?.user_metadata?.bio || '');

  const handleSave = async () => {
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl, name: displayName, bio } });
    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated!');
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-4">Profile Settings</h1>

      {userMetadata && (
        <div className="bg-zinc-900 border border-zinc-700 p-4 rounded mb-6 text-sm">
          <h2 className="font-semibold mb-2">User Metadata</h2>
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(userMetadata, null, 2)}
          </pre>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Taylor Swift"
          />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Input
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short description..."
          />
        </div>
        <div>
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
          />
        </div>
        <div className="flex gap-2 items-center">
          <img
            src={avatarUrl || '/default-avatar.png'}
            alt="preview"
            className="w-16 h-16 rounded-full border border-white object-cover"
          />
          <Button onClick={handleSave}>Save</Button>
        </div>

        <div className="pt-6 space-y-4 border-t border-zinc-700 mt-6">
          <h2 className="text-lg font-semibold">Account Actions</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              variant="secondary"
              onClick={async () => {
                const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
                  redirectTo: `${window.location.origin}/reset`
                });
                error
                  ? toast.error('Failed to send reset email')
                  : toast.success('Reset email sent!');
              }}
            >
              Send Password Reset Email
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const { error } = await supabase.rpc('send_email_verification_with_log', {
                  user_agent: navigator.userAgent,
                  sent_from: 'profile_page'
                });
                error
                  ? toast.error('Failed to send verification')
                  : toast.success('Verification email sent!');
              }}
            >
              Resend Verification Email
            </Button>
          </div>

          <div className="pt-6 space-y-4 border-t border-red-800 mt-6">
            <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
            <Button
              variant="destructive"
              onClick={async () => {
                const password = window.prompt('Please confirm your password to delete your account:');
                if (!password) return;
                const confirmed = window.confirm('Are you absolutely sure? This action cannot be undone.');
                if (!confirmed) return;

                const { error } = await supabase.rpc('delete_current_user_with_log', {
                  password_input: password
                });

                if (error) {
                  toast.error('Failed to delete account');
                } else {
                  toast.success('Account deleted');
                  setTimeout(() => {
                    window.location.href = '/goodbye';
                  }, 1500);
                }
              }}
            >
              Delete My Account
            </Button>
          </div>

          <div className="pt-6 space-y-4 border-t border-yellow-700 mt-6">
            <h2 className="text-lg font-semibold text-yellow-400">Admin Log</h2>
            <button
              className="text-xs text-blue-400 hover:underline"
              onClick={() => setShowUtc(v => !v)}
            >
              Toggle UTC ({showUtc ? 'Local' : 'UTC'})
            </button>
            <p className="text-sm text-zinc-400 mt-2">
              Most recent deletion:
              <code className="ml-2 bg-zinc-800 px-2 py-1 rounded text-xs text-yellow-300">
                {latestLog
                  ? `${latestLog.email} • ${format(new Date(latestLog.deleted_at), showUtc ? 'MMM d, yyyy HH:mm 'UTC'' : 'MMM d, yyyy HH:mm zzz')}
 (${formatDistanceToNow(new Date(latestLog.deleted_at), { addSuffix: true })})` + (latestLog.admin_actor ? ` (by ${latestLog.admin_actor})` : '')
                  : 'Loading...'}
              </code>
            </p>
            <p className="text-sm text-zinc-400">
              Account deletions are recorded in <code className="bg-zinc-800 px-1 rounded">user_deletion_logs</code>. This table stores the user ID, email, and timestamp. Admins can view and audit this log from the Supabase dashboard or the audit UI. Local timezone is: <code className="bg-zinc-800 px-1 rounded">{timeZone}</code>.
              A similar log is recorded for verification emails via the <code className="bg-zinc-800 px-1 rounded">verification_logs</code> table, including user agent and origin info.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
