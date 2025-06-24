'use client';

import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import { useCurrentUser } from '@/hooks/useCurrentUser'; // ✅ NEW
import { supabase } from '@/admin/lib/supabaseClient';
import toast from 'react-hot-toast';

export default function RequestAccessPage() {
  const { role } = useCanonicalRole();
  const { user } = useCurrentUser(); // ✅ FIXED
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    setEmail(user.email || '');

    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from('access_requests').insert({
      org: profile?.org || null,
      role: role || null,
      email,
      message,
      status: 'pending',
    });

    if (error) toast.error('Request failed');
    else toast.success('Request submitted');

    setSubmitting(false);
    setMessage('');
  };

  return (
    <>
      <Head>
        <title>Request Access</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <form
          onSubmit={handleSubmit}
          className="bg-gray-800 p-6 rounded shadow-md w-full max-w-md space-y-4"
        >
          <h1 className="text-xl font-semibold">Request Admin Access</h1>
          <p className="text-sm text-gray-400">
            Email: <span className="text-white font-medium">{email || 'Not signed in'}</span>
          </p>
          <textarea
            className="w-full p-2 rounded bg-gray-700 text-sm text-white"
            placeholder="Explain your reason for requesting admin access..."
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={submitting || !email}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </>
  );
}
