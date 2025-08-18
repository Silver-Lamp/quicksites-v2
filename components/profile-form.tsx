// components/ProfileForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { RewardTally } from '@/components/reward-tally';

export default function ProfileForm() {
  const { user, role } = useCurrentUser();
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url ?? '');
  const [displayName, setDisplayName] = useState(user?.user_metadata?.name ?? '');
  const [bio, setBio] = useState(user?.user_metadata?.bio ?? '');
  const [showUtc, setShowUtc] = useState(false);
  const [latestLog, setLatestLog] = useState<any | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [refLink, setRefLink] = useState('');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const email = user?.email ?? '';

  useEffect(() => {
    if (user?.id) {
      (async () => {
        try {
          const res = await fetch(`/api/reward-points?user_id=${user.id}`);
          const d = await res.json();
          setRewardPoints(d.total || 0);
          setRefLink(`${window.location.origin}/?ref=${user.id}`);
        } catch {
          setRewardPoints(0);
        }
      })();
    }
  }, [user?.id]);

  useEffect(() => {
    if (role === 'admin') {
      supabase
        .from('user_deletion_logs')
        .select('id, email, deleted_at, user_id, admin_actor, reason')
        .order('deleted_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data?.length) setLatestLog(data[0]);
        });

      supabase
        .from('access_requests')
        .select('id, email, requested_at, reason')
        .order('requested_at', { ascending: false })
        .limit(10)
        .then(({ data }) => {
          if (data?.length) setAccessRequests(data);
        });
    }
  }, [role]);

  const handleSave = async () => {
    const { error } = await supabase.auth.updateUser({
      data: {
        avatar_url: avatarUrl,
        name: displayName,
        bio,
        updated_at: new Date().toISOString(),
      },
    });
    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated!');
    }
  };

  const requestAccess = async () => {
    setRequesting(true);
    const { error } = await supabase.from('access_requests').insert({
      user_id: user?.id,
      email,
      requested_at: new Date().toISOString(),
      reason: 'Wants to edit profile info',
    });
    if (error) {
      toast.error('Failed to submit access request');
    } else {
      toast.success('Access request sent!');
    }
    setRequesting(false);
  };

  const handleApprove = async (req: any) => {
    const { error } = await supabase.from('user_profiles').upsert({
      user_id: req.user_id,
      email: req.email,
      role: 'reseller',
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast.error(`Failed to approve ${req.email}`);
    } else {
      toast.success(`${req.email} approved as reseller`);
      setAccessRequests(accessRequests.filter((r) => r.id !== req.id));
    }
  };

  const handleDeny = async (req: any) => {
    const { error } = await supabase.from('access_requests').delete().eq('id', req.id);
    if (error) {
      toast.error(`Failed to deny ${req.email}`);
    } else {
      toast.success(`Denied request from ${req.email}`);
      setAccessRequests(accessRequests.filter((r) => r.id !== req.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-white">
        <h1 className="text-2xl font-bold mb-2">👤 Profile</h1>
        {user && (
          <>
            <div className="mb-6">
              <RewardTally points={rewardPoints} />
            </div>
            <div className="bg-zinc-800 p-4 rounded text-sm">
              <div className="text-zinc-400 mb-1">Your referral link:</div>
              <code className="text-blue-400">{refLink}</code>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Label>Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Taylor Swift"
          />
        </div>
        <div>
          <Label>Bio</Label>
          <Input
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short description..."
          />
        </div>
        <div>
          <Label>Avatar URL</Label>
          <Input
            id="avatarUrl"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
          />
        </div>

        <div className="flex gap-2 items-center">
          <Image
            src={avatarUrl || '/default-avatar.png'}
            alt="preview"
            width={64}
            height={64}
            className="rounded-full border border-white object-cover"
          />
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>

      {role !== 'admin' && (
        <div className="pt-6">
          <Button
            variant="outline"
            disabled={requesting}
            onClick={requestAccess}
          >
            Request Elevated Access
          </Button>
        </div>
      )}

      {role === 'admin' && accessRequests.length > 0 && (
        <div className="pt-6">
          <h2 className="text-lg font-semibold text-white mb-3">Access Requests</h2>
          <div className="space-y-3">
            {accessRequests.map((req) => (
              <div key={req.id} className="bg-zinc-800 p-3 rounded">
                <div className="text-sm text-zinc-300">
                  <span className="font-bold text-white">{req.email}</span> wants access — reason:
                  <span className="italic"> {req.reason}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(req)}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => handleDeny(req)}>Deny</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {role === 'admin' && (
        <div className="pt-6">
          <h2 className="text-lg font-semibold text-yellow-400">Admin Log</h2>
          <button
            className="text-xs text-blue-400 hover:underline"
            onClick={() => setShowUtc((v) => !v)}
          >
            Toggle UTC ({showUtc ? 'Local' : 'UTC'})
          </button>
          <p className="text-sm text-zinc-400 mt-2">
            Most recent deletion:
            <code className="ml-2 bg-zinc-800 px-2 py-1 rounded text-xs text-yellow-300">
              {latestLog
                ? `${latestLog.email} • ${new Date(latestLog.deleted_at).toLocaleString('en-US', {
                    timeZone: showUtc ? 'UTC' : timeZone,
                  })}`
                : 'Loading...'}
            </code>
          </p>
          <p className="text-sm text-zinc-400">
            Admin deletions and access approvals are tracked in the database.
          </p>
        </div>
      )}
    </div>
  );
}
