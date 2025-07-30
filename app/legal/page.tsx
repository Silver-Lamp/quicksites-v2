import PrivacyContent from '@/app/legal/PrivacyContent';
import TermsContent from '@/app/legal/TermsContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal - QuickSites',
  description: 'Privacy policy and terms of service for QuickSites.',
};

export default function LegalPage() {
  return (
    <>
      <PrivacyContent />
      <TermsContent />
    </>
  );
}
