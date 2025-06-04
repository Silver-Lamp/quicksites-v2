
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/router';
import Link from 'next/link';
import type { DomainEntry } from '@/types/domain.types';
import AdminTabs from '@/components/admin/AdminTabs';

export default function Dashboard() {
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const role = data?.user?.user_metadata?.role;
      if (role === 'viewer') {
        router.push('/viewer');
      } else if (role !== 'admin' && role !== 'reseller') {
        router.push('/login?error=unauthorized');
      }
    });

    supabase
      .from('domains')
      .select('*')
      .order('date_created', { ascending: false })
      .then(({ data }) => {
        setDomains(data || []);
      });
  }, []);

  return (
    <>
      <AdminTabs />
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4 text-white">Claimed Sites</h1>
        <table className="w-full text-sm text-left text-gray-300 bg-gray-800 rounded overflow-hidden">
          <thead className="bg-gray-700 text-gray-100 uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-2">Domain</th>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2">State</th>
              <th className="px-4 py-2">Template</th>
              <th className="px-4 py-2">Claimed</th>
              <th className="px-4 py-2">Preview</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d: any, i) => (
              <>
                <tr key={d.id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
                  <td className="px-4 py-2">{d.domain}</td>
                  <td className="px-4 py-2">{d.city}</td>
                  <td className="px-4 py-2">{d.state}</td>
                  <td className="px-4 py-2">{d.template_id}</td>
                  <td className="px-4 py-2">{d.is_claimed ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">
                    <button
                      className="text-blue-400 hover:underline text-xs"
                      onClick={() => setPreviewing(previewing === d.domain ? null : d.domain)}
                    >
                      {previewing === d.domain ? 'Hide' : 'Show'}
                    </button>
                    <a
                      href={`https://${d.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-400 hover:underline text-xs"
                    >
                      Open
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/domain/${d.domain}`}>
                      <span className="text-blue-400 hover:underline">View</span>
                    </Link>
                  </td>
                </tr>
                {previewing === d.domain && (
                  <tr className="bg-black">
                    <td colSpan={7} className="p-4 text-center">
                      <iframe
                        src={`https://${d.domain}`}
                        className="w-full h-96 border rounded"
                        onError={(e) => {
                          const img = document.createElement('img');
                          img.src = `/screenshots/${d.domain}.png`;
                          img.alt = 'Screenshot fallback';
                          img.className = 'mx-auto max-w-full max-h-96 rounded';
                          e.currentTarget.replaceWith(img);
                        }}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
