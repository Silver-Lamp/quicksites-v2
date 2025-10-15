// components/electinfo/DonationsBlock.tsx
import { Entitlements } from '@/lib/electinfo/features';
import GatedFeature from './GatedFeature';

export default function DonationsBlock({ entitlements, siteId }: { entitlements: Entitlements, siteId: string }) {
  return (
    <GatedFeature feature="donations" enabled={entitlements.donations} label="Donations" siteId={siteId} slug="donations">
      <div className="rounded-2xl border p-6">
        <h3 className="text-xl font-semibold">Donate to the Campaign</h3>
        <p>This feature is not available yet. Please notify the campaign to unlock it.</p>
      </div>
    </GatedFeature>
  );
}
