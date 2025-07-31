'use client';

import { useParams } from 'next/navigation';
import ClaimPage from '@/components/claim/claim-page';

export default function ClaimDomainPage() {
  const params = useParams();
  const domain = params.domain as string;
  return <ClaimPage domain={domain} />;
}
