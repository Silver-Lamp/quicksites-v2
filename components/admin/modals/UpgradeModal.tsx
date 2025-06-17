'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  context?: string;
  triggerReason?: string;
}

export default function UpgradeModal({
  open,
  onClose,
  context,
  triggerReason,
}: UpgradeModalProps) {
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [inferredContext, setInferredContext] = useState<string | null>(null);
  const [finalTrigger, setFinalTrigger] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathnameContext = context || window.location.pathname;
      const reason = searchParams?.get('reason') || triggerReason || null;

      const url = new URL(window.location.href);
      const referrer = document.referrer || null;
      const page_url = window.location.href || null;

      const utm_source = url.searchParams.get('utm_source');
      const utm_medium = url.searchParams.get('utm_medium');
      const utm_campaign = url.searchParams.get('utm_campaign');
      const utm_term = url.searchParams.get('utm_term');
      const utm_content = url.searchParams.get('utm_content');

      setInferredContext(pathnameContext);
      setFinalTrigger(reason);

      setMetadata({
        referrer,
        page_url,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
      });
    }
  }, [context, triggerReason, searchParams]);

  useEffect(() => {
    if (open && inferredContext) {
      supabase.from('guest_upgrade_events').insert([
        {
          context: inferredContext,
          user_id: user?.id || null,
          email: user?.email || null,
          event_type: 'view',
          trigger_reason: finalTrigger,
          ...metadata,
        },
      ]);
    }
  }, [open, inferredContext, finalTrigger, metadata, user]);

  const handleUpgrade = async () => {
    setLoading(true);
    await supabase.from('guest_upgrade_events').insert([
      {
        context: inferredContext,
        user_id: user?.id || null,
        email: user?.email || null,
        event_type: 'click',
        trigger_reason: finalTrigger,
        ...metadata,
      },
    ]);
    window.location.href =
      '/sign-up?redirect_url=' + encodeURIComponent(window.location.href);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Create an Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground">
            You’ve reached a feature that requires a free account. Sign up to
            unlock saving, publishing, and full access.
          </p>
          <Button onClick={handleUpgrade} disabled={loading} className="w-full">
            {loading ? 'Redirecting...' : 'Sign up for free'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
