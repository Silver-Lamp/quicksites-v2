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
import { Badge } from '@/components/ui/badge';
import { Loader, Rocket, ChartBar, Mail, Map, Phone, ImageIcon, Star, Shield, Link2, Sparkles } from 'lucide-react';

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

  // Membership state
  const [membership, setMembership] = useState<any | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(true);
  const [sendingTrialReq, setSendingTrialReq] = useState(false);

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

  // Fetch membership info for this user
  useEffect(() => {
    (async () => {
      try {
        setLoadingMembership(true);
        const r = await fetch('/api/me/membership', { cache: 'no-store' });
        const j = await r.json();
        if (r.ok && j?.membership) setMembership(j.membership);
      } catch {
        // ignore
      } finally {
        setLoadingMembership(false);
      }
    })();
  }, []);

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

  const requestProTrial = async () => {
    try {
      setSendingTrialReq(true);
      const r = await fetch('/api/contact/pro-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          message: `User ${email} requested a Pro trial from Profile page`,
          context: { page: 'profile' },
        }),
      });
      if (!r.ok) throw new Error('Request failed');
      toast.success('Request sent! We\'ll reach out shortly.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not send request');
    } finally {
      setSendingTrialReq(false);
    }
  };

  const statusBadge = () => {
    if (!membership) return null;
    const s = membership.status;
    if (s === 'trialing') return <Badge>Trialing</Badge>;
    if (s === 'active') return <Badge variant="default">Active</Badge>;
    if (s === 'none') return <Badge variant="secondary">Free</Badge>;
    return <Badge variant="secondary">{s}</Badge>;
  };

  const trialEnds = membership?.trial_end ? new Date(membership.trial_end) : null;
  const trialActive = membership?.status === 'trialing' && trialEnds && trialEnds.getTime() > Date.now();

  return (
    <div className="space-y-6">
      <div className="text-white">
        <h1 className="text-2xl font-bold mb-2">👤 Profile</h1>
        {user && (
          <>
            <div className="mb-6">
              <RewardTally points={rewardPoints} />
            </div>

            {/* Membership card */}
            <div className="bg-zinc-800 p-4 rounded text-sm border border-zinc-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-zinc-400">Membership</div>
                  {loadingMembership ? (
                    <div className="flex items-center gap-2 mt-1 text-zinc-300">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span>Loading…</span>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium capitalize">{membership?.label ?? 'Free'}</span>
                        {statusBadge()}
                      </div>
                      {trialActive && (
                        <div className="text-xs text-zinc-400 mt-1">
                          Trial ends {trialEnds?.toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={requestProTrial}
                    disabled={sendingTrialReq || trialActive || !user?.id}
                    className={!user?.id ? 'opacity-50 cursor-not-allowed' : ''}
                    title={trialActive ? 'Trial already active' : 'Request a Pro trial'}
                  >
                    {sendingTrialReq ? 'Sending…' : 'Request Pro Trial'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-zinc-800 p-4 rounded text-sm">
              <div className="text-zinc-400 mb-1">Your referral link:</div>
              <code className="text-blue-400 break-all">{refLink}</code>
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

      {/* Features scroller */}
      <FeaturesScroller />
    </div>
  );
}

function FeaturesScroller() {
  const items = [
    { icon: Sparkles, title: 'Instant AI sites', blurb: 'Generate and launch templates fast with AI-assisted blocks.' },
    { icon: ChartBar, title: 'SEO + GSC', blurb: 'Bulk stats, CTR/position tables, sitemaps & robots per site.' },
    { icon: ImageIcon, title: 'OG & previews', blurb: 'Live OG image generation and shareable comparison cards.' },
    { icon: Mail, title: 'Inbox & forms', blurb: 'Centralized lead capture, contact routing, and notifications.' },
    { icon: Phone, title: 'Call tracking', blurb: 'Twilio logs and attribution to pages, campaigns, and leads.' },
    { icon: Map, title: 'The Grid', blurb: 'Geographic coverage map with revenue estimator & CTAs.' },
    { icon: Star, title: 'Campaigns', blurb: 'City races, second-chance flows, and claim funnels.' },
    { icon: Shield, title: 'Compliance', blurb: 'Profiles & snapshots to keep merchants in good standing.' },
    { icon: Link2, title: 'Affiliate mode', blurb: 'Referrals, payouts, and scoped dashboards for partners.' },
    { icon: Rocket, title: 'Pro performance', blurb: 'Faster builds, priority features, and advanced blocks.' },
  ];
  return (
    <div className="pt-8">
      <h3 className="text-white font-semibold mb-3">What you get with Pro</h3>
      <div className="-mx-4 px-4 overflow-x-auto">
        <ul className="flex gap-3 pb-2">
          {items.map((f) => (
            <li key={f.title} className="min-w-[240px] shrink-0 rounded-2xl border border-zinc-700 bg-zinc-800 p-4">
              <div className="flex items-center gap-2">
                <f.icon className="h-5 w-5" />
                <div className="text-white font-medium">{f.title}</div>
              </div>
              <div className="text-sm text-zinc-400 mt-2">{f.blurb}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}