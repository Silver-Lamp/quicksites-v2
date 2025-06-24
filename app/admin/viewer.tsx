'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import { supabase } from '@/admin/lib/supabaseClient';
import dayjs from 'dayjs';
import Image from 'next/image';

export default function ViewerDashboard() {
  const [domains, setDomains] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const router = useRouter();
  const { role } = useCanonicalRole();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      setEmail(user?.email || '');
    });
  }, []);

  useEffect(() => {
    if (role && role !== 'viewer') {
      router.push('/dashboard');
    }
  }, [role]);

  useEffect(() => {
    supabase
      .from('domains')
      .select('*, campaigns(*)')
      .order('date_created', { ascending: false })
      .then(({ data }) => setDomains(data || []));
  }, []);

  const logClick = async (domain_id: string, action_type: string) => {
    await supabase.from('user_action_logs').insert([
      {
        domain_id,
        action_type,
        triggered_by: email,
      },
    ]);
  };

  const renderTimer = (campaign: any) => {
    if (!campaign) return '—';
    const now = dayjs();
    const end = dayjs(campaign.ends_at);
    const diff = end.diff(now, 'minute');
    return diff > 0 ? `${diff} min left` : 'Expired';
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Site Viewer</h1>
      <table className="w-full text-sm text-left text-gray-300 bg-gray-800 rounded overflow-hidden">
        <thead className="bg-gray-700 text-gray-100 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-2">Domain</th>
            <th className="px-4 py-2">City</th>
            <th className="px-4 py-2">Timer</th>
            <th className="px-4 py-2">Preview</th>
            <th className="px-4 py-2">Contact</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d, i) => (
            <tr key={d.id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
              <td className="px-4 py-2">{d.domain}</td>
              <td className="px-4 py-2">{d.city}</td>
              <td className="px-4 py-2 text-xs">
                {d.campaigns ? (
                  <span className="bg-yellow-600 text-black px-2 py-1 rounded">
                    {renderTimer(d.campaigns)}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-2">
                <Image
                  src={d.screenshot_url}
                  alt="screenshot"
                  width={128}
                  height={72}
                  className="w-32 border rounded cursor-pointer"
                  onClick={() => logClick(d.id, 'click_preview')}
                />
              </td>
              <td className="px-4 py-2">
                <a
                  href={`mailto:support@quicksites.ai?subject=Claim ${d.domain}`}
                  className="text-blue-400 hover:underline text-xs"
                  onClick={() => logClick(d.id, 'click_claim')}
                >
                  Claim Site
                </a>
              </td>
            </tr>
          ))}
          {domains.map((d, _i) => {
            const alt = d.campaigns?.alt_domains?.[d.campaigns.lead_ids?.indexOf(d.lead_id)];
            const hasClaimed = d.domains?.is_claimed;

            return !hasClaimed && alt ? (
              <tr key={d.id + '-alt'} className="bg-black text-yellow-400 text-xs">
                <td colSpan={5} className="px-4 py-2 space-y-2">
                  🛠️ Second Chance Site available:
                  <a
                    href={`https://${alt}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-400 underline"
                    onClick={() => logClick(d.id, 'click_second_chance')}
                  >
                    {alt}
                  </a>
                  <br />
                  <a
                    href={`mailto:support@quicksites.ai?subject=Interested in second site&body=I'm interested in claiming ${alt}`}
                    className="inline-block bg-yellow-500 text-black px-3 py-1 mt-1 rounded text-xs"
                    onClick={() => logClick(d.id, 'second_chance_interest')}
                  >
                    I&apos;m Interested
                  </a>
                </td>
              </tr>
            ) : null;
          })}
        </tbody>
      </table>
    </div>
  );
}
