// components/admin/referral-link.tsx
// Use ReferralLink() when you need to display the referral link
// Use getUserFromRequest() when you need the user context
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export default function ReferralLink() {
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || '');
      setUserId(data?.user?.id || '');
    });
  }, []);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const link = `${baseUrl}/register?ref=${userId}`;

  return (
    <div className="text-white text-sm bg-gray-800 p-4 rounded mt-6">
      <p className="mb-1">Referral Link:</p>
      <input
        value={link}
        readOnly
        className="w-full bg-gray-700 px-3 py-1 border border-gray-600 rounded text-xs"
        onClick={(e) => (e.target as HTMLInputElement).select()}
      />
      <p className="text-xs text-gray-400 mt-1">
        Share this to invite resellers and earn 10% recurring.
      </p>
    </div>
  );
}
