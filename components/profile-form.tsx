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
import {
  Loader, Rocket, ChartBar, Mail, Map, Phone, ImageIcon, Star, Shield, Link2,
  Sparkles, Check, Copy, Crown, Gift, UserRound, Palette,
} from 'lucide-react';
import AiCostEstimatorCard from '@/components/admin/billing/AiCostEstimatorCard';
import WorkBackgroundPicker from '@/components/profile/work-background-picker';

/* ---------- shared UI ---------- */

function Section({
  title, icon: Icon, desc, children, right,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  desc?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-zinc-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {desc && <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const PRO_FEATURES = [
  { icon: Sparkles, title: 'Instant AI sites', blurb: 'Generate and launch templates fast with AI-assisted blocks.' },
  { icon: ChartBar, title: 'SEO + Search Console', blurb: 'Bulk stats, CTR/position tables, sitemaps & robots per site.' },
  { icon: ImageIcon, title: 'OG & previews', blurb: 'Live OG image generation and shareable comparison cards.' },
  { icon: Mail, title: 'Inbox & forms', blurb: 'Centralized lead capture, contact routing, and notifications.' },
  { icon: Phone, title: 'Call tracking', blurb: 'Twilio logs and attribution to pages, campaigns, and leads.' },
  { icon: Map, title: 'The Grid', blurb: 'Geographic coverage map with revenue estimator & CTAs.' },
  { icon: Star, title: 'Campaigns', blurb: 'City races, second-chance flows, and claim funnels.' },
  { icon: Shield, title: 'Compliance', blurb: 'Profiles & snapshots to keep merchants in good standing.' },
  { icon: Link2, title: 'Affiliate mode', blurb: 'Referrals, payouts, and scoped dashboards for partners.' },
  { icon: Rocket, title: 'Pro performance', blurb: 'Faster builds, priority features, and advanced blocks.' },
];

export default function ProfileForm() {
  const { user, role } = useCurrentUser();
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url ?? '');
  const [displayName, setDisplayName] = useState(user?.user_metadata?.name ?? '');
  const [bio, setBio] = useState(user?.user_metadata?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [showUtc, setShowUtc] = useState(false);
  const [latestLog, setLatestLog] = useState<any | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [refLink, setRefLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Membership state
  const [membership, setMembership] = useState<any | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(true);
  const [sendingTrialReq, setSendingTrialReq] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [managing, setManaging] = useState(false);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const email = user?.email ?? '';

  // Keep local fields in sync once the user resolves (avoids empty defaults).
  useEffect(() => {
    setAvatarUrl(user?.user_metadata?.avatar_url ?? '');
    setDisplayName(user?.user_metadata?.name ?? '');
    setBio(user?.user_metadata?.bio ?? '');
  }, [user?.id]);

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
      ;(supabase as any)
        .from('user_deletion_logs')
        .select('id, email, deleted_at, user_id, admin_actor, reason')
        .order('deleted_at', { ascending: false })
        .limit(1)
        .then(({ data }: { data: any }) => {
          if (data?.length) setLatestLog(data[0]);
        });

      ;(supabase as any)
        .from('access_requests')
        .select('id, email, requested_at, reason')
        .order('requested_at', { ascending: false })
        .limit(10)
        .then(({ data }: { data: any }) => {
          if (data?.length) setAccessRequests(data);
        });
    }
  }, [role]);

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
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl, name: displayName, bio, updated_at: new Date().toISOString() },
    });
    setSaving(false);
    if (error) toast.error('Failed to update profile');
    else toast.success('Profile updated!');
  };

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(refLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Could not copy');
    }
  };

  const requestAccess = async () => {
    setRequesting(true);
    const { error } = await (supabase as any).from('access_requests').insert({
      user_id: user?.id, email, requested_at: new Date().toISOString(), reason: 'Wants to edit profile info',
    });
    if (error) toast.error('Failed to submit access request');
    else toast.success('Access request sent!');
    setRequesting(false);
  };

  const handleApprove = async (req: any) => {
    const { error } = await supabase.from('user_profiles').upsert({
      user_id: req.user_id, email: req.email, role: 'reseller',
    } as any);
    if (error) toast.error(`Failed to approve ${req.email}`);
    else {
      toast.success(`${req.email} approved as reseller`);
      setAccessRequests(accessRequests.filter((r) => r.id !== req.id));
    }
  };

  const handleDeny = async (req: any) => {
    const { error } = await (supabase as any).from('access_requests').delete().eq('id', req.id);
    if (error) toast.error(`Failed to deny ${req.email}`);
    else {
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
        body: JSON.stringify({ plan: 'pro', message: `User ${email} requested a Pro trial from Profile page`, context: { page: 'profile' } }),
      });
      if (!r.ok) throw new Error('Request failed');
      toast.success("Request sent! We'll reach out shortly.");
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not send request');
    } finally {
      setSendingTrialReq(false);
    }
  };

  const handleUpgradeToPro = async () => {
    setUpgrading(true);
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'pro' }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.url) {
        window.location.href = j.url;
        return;
      }
      // Self-serve Stripe checkout isn't available yet (e.g. STRIPE_PRICE_PRO_MONTHLY
      // isn't configured → "missing price id"). Don't dead-end on a raw error —
      // capture the intent via the contact/trial flow instead.
      await requestProTrial();
    } catch {
      await requestProTrial();
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setManaging(true);
      const r = await fetch('/api/billing/portal');
      const j = await r.json();
      if (!r.ok || !j?.url) throw new Error(j?.error || 'Could not open portal');
      window.location.href = j.url;
    } catch (e: any) {
      toast.error(e?.message || 'Could not open portal');
    } finally {
      setManaging(false);
    }
  };

  const status: string | undefined = membership?.status;
  const planLabel: string = membership?.label ?? 'Free';
  const trialEnds = membership?.trial_end ? new Date(membership.trial_end) : null;
  const trialActive = status === 'trialing' && trialEnds && trialEnds.getTime() > Date.now();
  const isMember = !!status && status !== 'none'; // active or trialing
  const isPro = isMember;

  const StatusBadge = () => {
    if (loadingMembership) return null;
    if (status === 'trialing') return <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">Trialing</Badge>;
    if (status === 'active') return <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Active</Badge>;
    return <Badge variant="secondary">Free</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* ---------- Identity header ---------- */}
      <div className="flex items-center gap-4">
        <Image
          src={avatarUrl || '/default-avatar.png'}
          alt="avatar"
          width={64}
          height={64}
          className="h-16 w-16 rounded-full border border-zinc-700 object-cover"
        />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">{displayName || 'Your profile'}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
            <span className="truncate">{email}</span>
            <StatusBadge />
          </div>
        </div>
      </div>

      {!user ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
          Please sign in to view your profile.
        </div>
      ) : (
        <>
          {/* ---------- Plan / Pro ---------- */}
          <Section
            title="Plan"
            icon={Crown}
            desc="Manage your QuickSites subscription."
            right={<span className="text-sm font-medium capitalize text-white">{planLabel}</span>}
          >
            {loadingMembership ? (
              <div className="flex items-center gap-2 text-zinc-300">
                <Loader className="h-4 w-4 animate-spin" /> <span className="text-sm">Loading…</span>
              </div>
            ) : isPro ? (
              // Member: show status + manage billing.
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-300">
                  {trialActive ? (
                    <>You&apos;re on a <span className="font-medium text-white">Pro trial</span> — ends{' '}
                      <span className="text-white">{trialEnds?.toLocaleDateString()}</span>.</>
                  ) : (
                    <>Your <span className="font-medium text-white">Pro</span> plan is active. Thanks for the support.</>
                  )}
                </div>
                <Button variant="secondary" onClick={handleManageBilling} disabled={managing}>
                  {managing ? 'Opening…' : 'Manage billing'}
                </Button>
              </div>
            ) : (
              // Free: upgrade CTA + inline benefits + soft trial option.
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-300">
                    You&apos;re on the <span className="font-medium text-white">Free</span> plan. Upgrade to Pro for
                    faster builds, advanced blocks, and priority features.
                  </p>
                  <div className="flex shrink-0 items-center gap-3">
                    <Button
                      onClick={handleUpgradeToPro}
                      disabled={upgrading}
                      className="bg-purple-600 hover:bg-purple-500"
                    >
                      <Crown className="mr-1.5 h-4 w-4" />
                      {upgrading ? 'Redirecting…' : 'Upgrade to Pro'}
                    </Button>
                  </div>
                </div>
                <button
                  onClick={requestProTrial}
                  disabled={sendingTrialReq || !!trialActive}
                  className="text-xs font-medium text-purple-300 hover:text-purple-200 disabled:opacity-50"
                >
                  {sendingTrialReq ? 'Sending…' : 'Prefer to try first? Request a free Pro trial →'}
                </button>

                {/* Inline benefits (was an orphaned scroller at the bottom) */}
                <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                  {PRO_FEATURES.slice(0, 6).map((f) => (
                    <div key={f.title} className="flex items-start gap-2 rounded-lg bg-zinc-800/50 px-3 py-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <div>
                        <div className="text-sm font-medium text-white">{f.title}</div>
                        <div className="text-xs text-zinc-400">{f.blurb}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ---------- Account details ---------- */}
          <Section title="Account details" icon={UserRound} desc="How you appear across QuickSites.">
            <div className="space-y-4">
              <div>
                <Label>Display Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Johnathan Swift" className="mt-1 bg-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
              <div>
                <Label>Bio</Label>
                <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short description…" className="mt-1 bg-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
              <div>
                <Label>Avatar URL</Label>
                <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.png" className="mt-1 bg-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </div>
          </Section>

          {/* ---------- Rewards & referral ---------- */}
          <Section title="Rewards & referrals" icon={Gift} desc="Earn points and share your link.">
            <div className="space-y-4">
              <RewardTally points={rewardPoints} />
              <div>
                <Label>Your referral link</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-sky-300">
                    {refLink || '—'}
                  </code>
                  <Button variant="secondary" size="sm" onClick={copyRef} disabled={!refLink}>
                    {copied ? <><Check className="mr-1 h-3.5 w-3.5" /> Copied</> : <><Copy className="mr-1 h-3.5 w-3.5" /> Copy</>}
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          {/* ---------- Preferences ---------- */}
          <Section title="Workspace" icon={Palette} desc="A subtle texture behind the admin — yours only.">
            <WorkBackgroundPicker />
          </Section>

          <AiCostEstimatorCard />

          {/* ---------- Access (non-admin) ---------- */}
          {role !== 'admin' && (
            <div>
              <Button variant="outline" disabled={requesting} onClick={requestAccess}>
                {requesting ? 'Requesting…' : 'Request elevated access'}
              </Button>
            </div>
          )}

          {/* ---------- Admin: access requests ---------- */}
          {role === 'admin' && accessRequests.length > 0 && (
            <Section title="Access requests" icon={Shield}>
              <div className="space-y-3">
                {accessRequests.map((req) => (
                  <div key={req.id} className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
                    <div className="text-sm text-zinc-300">
                      <span className="font-bold text-white">{req.email}</span> wants access —
                      <span className="italic"> {req.reason}</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(req)}>Approve</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleDeny(req)}>Deny</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ---------- Admin: log ---------- */}
          {role === 'admin' && (
            <Section
              title="Admin log"
              icon={Shield}
              right={
                <button className="text-xs text-sky-400 hover:underline" onClick={() => setShowUtc((v) => !v)}>
                  {showUtc ? 'UTC' : 'Local'}
                </button>
              }
            >
              <p className="text-sm text-zinc-400">
                Most recent deletion:{' '}
                <code className="rounded bg-zinc-800 px-2 py-1 text-xs text-amber-300">
                  {latestLog
                    ? `${latestLog.email} • ${new Date(latestLog.deleted_at).toLocaleString('en-US', { timeZone: showUtc ? 'UTC' : timeZone })}`
                    : 'Loading…'}
                </code>
              </p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
