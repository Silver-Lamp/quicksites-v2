// components/electinfo/UnlockCTA.tsx
'use client';

import * as React from 'react';
import type { FeatureCode } from '@/lib/electinfo/features';
import { Mail, MessageSquare, Bell } from 'lucide-react';

type Props = {
  feature: FeatureCode;
  siteId?: string;
  slug?: string;
  /** show the “Text” button (off by default) */
  allowText?: boolean;
  /** show the “Email” button (off by default) */
  allowEmail?: boolean;
};

export default function UnlockCTA({
  feature,
  siteId,
  slug,
  allowText = false,
  allowEmail = false,
}: Props) {
  const [sending, setSending] = React.useState(false);

  const smsHref = `sms:?&body=${encodeURIComponent(
    `Hi! I'd like to enable ${feature} on my ElectInfo page.`
  )}`;

  const emailHref = `mailto:?subject=${encodeURIComponent(
    `Enable ${feature} on my ElectInfo page`
  )}&body=${encodeURIComponent('Please enable this for my campaign page. Thanks!')}`;

  async function requestUnlock() {
    setSending(true);
    try {
      await fetch('/api/electinfo/unlock-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, site_id: siteId, slug }),
      });
      alert('Thanks! We’ll notify the campaign.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {allowText && (
        <a
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
          href={smsHref}
          aria-label="Text the campaign"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Text</span>
        </a>
      )}

      {allowEmail && (
        <a
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
          href={emailHref}
          aria-label="Email the campaign"
        >
          <Mail className="h-4 w-4" />
          <span className="hidden sm:inline">Email</span>
        </a>
      )}

      <button
        onClick={requestUnlock}
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white shadow disabled:opacity-60"
        aria-label="Notify the campaign"
      >
        <Bell className="h-4 w-4" />
        {sending ? 'Sending…' : 'Notify'}
      </button>
    </div>
  );
}
