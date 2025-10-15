import GatedFeature from '@/components/electinfo/GatedFeature';
import type { Entitlements } from '@/lib/electinfo/features';

export default function CandidateDonations({
  content,
  entitlements,
  siteId,
  slug,
}: {
  content: { provider?: 'stripe' | 'actblue' | 'other'; url?: string };
  entitlements?: Entitlements;
  siteId?: string;
  slug?: string;
}) {
  const enabled = !!entitlements?.donations;

  return (
    <GatedFeature feature="donations" enabled={enabled} label="Donations" siteId={siteId} slug={slug}>
      <div className="rounded-2xl border p-6">
        {/* donation UI */}
      </div>
    </GatedFeature>
  );
}
