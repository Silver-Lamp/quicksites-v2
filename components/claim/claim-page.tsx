// components/claim/ClaimPage.tsx
'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createCheckoutSession } from '@/lib/stripe/createCheckoutSession';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@supabase/auth-helpers-react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ClaimPage({ domain }: { domain: string }) {
  const [email, setEmail] = useState('');
  const [isClaimed, setIsClaimed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const coupon = searchParams?.get('coupon') ?? undefined;

  useEffect(() => {
    if (session?.user?.email) setEmail(session.user.email);

    const checkClaim = async () => {
      const { data: template, error } = await supabase
        .from('templates')
        .select('id, claimed_by')
        .eq('custom_domain', domain)
        .single();

      if (template?.claimed_by) {
        setIsClaimed(true);
        return;
      }

      if (template?.id) {
        setTemplateId(template.id);

        // Try to match existing lead
        const { data: leads } = await supabase
          .from('leads')
          .select('id')
          .eq('domain_id', template.id)
          .eq('email', email)
          .limit(1);

        if (leads?.length) setLeadId(leads[0].id);
      }
    };

    checkClaim();
  }, [domain, session, email]);

  const handleClaim = async () => {
    if (!email) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);

    let currentLeadId = leadId;

    // Insert or update lead
    if (templateId) {
      if (!currentLeadId) {
        const { data: existingLeads } = await supabase
          .from('leads')
          .select('id')
          .eq('domain_id', templateId)
          .eq('email', email)
          .limit(1);

        if (existingLeads?.length) {
          currentLeadId = existingLeads[0].id;
          await supabase
            .from('leads')
            .update({
              outreach_status: 'claimed',
              notes: 'Claimed via /claim flow',
            })
            .eq('id', currentLeadId);
        } else {
          const { data: inserted, error } = await supabase
            .from('leads')
            .insert({
              email,
              domain_id: templateId,
              outreach_status: 'claimed',
              source: 'claim_flow',
              notes: 'New lead from /claim',
            })
            .select()
            .single();

          if (!error && inserted?.id) currentLeadId = inserted.id;
        }
      }

      // Log action
      await supabase.from('user_action_logs').insert({
        lead_id: currentLeadId,
        domain_id: templateId,
        action_type: 'claim_checkout_started',
        triggered_by: email,
      });
    }

    const res = await createCheckoutSession({ domain, email, coupon });
    if (res?.url) {
      window.location.href = res.url;
    } else {
      setError('Could not start checkout session.');
      setLoading(false);
    }
  };

  if (isClaimed) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Already Claimed</h1>
        <p className="text-sm text-gray-600 mb-4">
          The site <strong>{domain}</strong> is already claimed.
        </p>
        <p className="text-sm text-gray-500">
          If this is an error, please contact <a href="mailto:support@quicksites.ai" className="underline">support@quicksites.ai</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-4">Claim {domain}</h1>
      <p className="mb-6 text-sm text-gray-600">
        Enter your email to start the claim process. You’ll be redirected to Stripe to complete payment.
      </p>
      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        disabled={!!session?.user?.email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-4 w-full"
      />
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <Button disabled={!email || loading} onClick={handleClaim} className="w-full">
        {loading ? 'Redirecting…' : 'Claim This Site'}
      </Button>
    </div>
  );
}
