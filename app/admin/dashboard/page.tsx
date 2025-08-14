// app/admin/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import AdminTabs from '@/components/admin/admin-tabs';
import { DashboardSelector } from '@/components/admin/dashboard-selector';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import DashboardGridDraggable from '@/components/admin/dashboard-grid-draggable';
import BlockSettingsModal from '@/components/admin/block-settings-modal';
import type { DomainEntry } from '@/types/domain.types';
import ActivityWidget from '@/components/admin/admin/blocks/activity-widget';
import EngagementWidget from '@/components/admin/admin/blocks/engagement-widget';
import RetentionWidget from '@/components/admin/admin/blocks/retention-widget';
import TrafficWidget from '@/components/admin/admin/blocks/traffic-widget';
import AuthGuard from '@/components/admin/auth-guard';
import ComplianceQueue from '@/components/admin/compliance/queue';
import MehkoCountiesAdmin from '@/components/admin/mehko-counties';

function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashboardFromURL = searchParams?.get('dashboard') as string | undefined;

  const { user } = useCurrentUser();
  const { role } = useCanonicalRole();

  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const {
    dashboards,
    activeDashboardId,
    setActiveDashboardId,
    createDashboard,
    order,
    hidden,
    save,
    loaded,
    loading,
    settings,
    updateBlockSetting,
  } = useDashboardLayout(user?.id || null, dashboardFromURL);

  useEffect(() => {
    if (activeDashboardId && searchParams?.get('dashboard') !== activeDashboardId) {
      console.log('🔐 [dashboard] Redirecting to dashboard (Reason: Active dashboard ID)');
      router.replace(`?dashboard=${activeDashboardId}`);
    }
  }, [activeDashboardId]);

  useEffect(() => {
    if (!role) return;
    if (role === 'viewer') {
      router.push('/viewer');
    } else if (!['admin', 'reseller', 'owner'].includes(role)) {
      console.log('🔐 [dashboard] Redirecting to login (Reason: Unauthorized)');
      router.push('/login?error=unauthorized');
    }

    import('@/admin/lib/supabaseClient').then(({ supabase }) => {
      supabase
        .from('domains')
        .select('*')
        .order('date_created', { ascending: false })
        .then(({ data }) => setDomains(data || []));
    });
  }, [role]);

  if (loading) {
    return <p className="text-gray-500 text-sm p-6">Loading dashboard layout…</p>;
  }

  return (
    <>
      <AdminTabs />
      {/* <AuthGuard roles={['admin', 'owner', 'reseller']}> */}
      <ComplianceQueue />
      <MehkoCountiesAdmin />
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4 text-white">My Dashboard</h1>
        <DashboardSelector
          dashboards={dashboards}
          activeDashboardId={activeDashboardId}
          setActiveDashboardId={setActiveDashboardId}
          onCreateNew={createDashboard}
        />
        <DashboardGridDraggable
          renderers={{
            activity: <ActivityWidget />, 
            engagement: <EngagementWidget />, 
            retention: <RetentionWidget />, 
            traffic: <TrafficWidget />,
          }}
          order={order}
          hidden={hidden}
          onSave={(o, h) => save(o, h)}
          onAddBlock={(b) => {
            if (!order.find((x) => x.id === b.id)) {
              save([...order, b], hidden);
            }
          }}
          settings={settings}
          updateBlockSetting={updateBlockSetting}
        />
      </div>
      {/* </AuthGuard> */}
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Claimed Sites</h2>
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
            {domains.map((d, i) => (
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

export default Dashboard;
