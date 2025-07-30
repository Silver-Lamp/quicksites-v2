import PrivacyContent from '@/app/legal/PrivacyContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - QuickSites',
  description: 'Learn how QuickSites protects your privacy and handles your data.',
};

export default function PrivacyPage() {
  return (
    <PrivacyContent />
  );
}
