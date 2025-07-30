import TermsContent from '@/app/legal/TermsContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - QuickSites',
  description: 'Understand the terms you agree to when using QuickSites.',
};

export default function TermsPage() {
  return (
      <TermsContent />
  );
}
