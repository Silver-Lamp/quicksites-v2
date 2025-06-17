// 'use client';
// import { useState, useEffect } from 'react';
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// import ThemedBarChart from '@/components/ui/ThemedBarChart';
// import { Modal } from '@/components/ui/Modal';
// import { Input, Label } from '@/components/ui/Form';
// import { Bar } from 'react-chartjs-2';

// export default function AnalyticsPage() {
//   const [supabase] = useState(() => createClientComponentClient());
//   const [showModal, setShowModal] = useState(false);
//   const [dateFrom, setDateFrom] = useState('');
//   const [dateTo, setDateTo] = useState('');
//   const [mode, setMode] = useState<'views' | 'events'>('views');
//     const [siteId, setSiteId] = useState('');
//   const [siteOptions, setSiteOptions] = useState<{ id: string; domain?: string; name?: string }[]>([]);

//   useEffect(() => {
//     supabase.from('public_sites').select('id, domain, name').then(({ data }) => {
//       if (data) setSiteOptions(data);
//     });
//   }, [supabase]);

//   const [dataByDay, setDataByDay] = useState<Record<string, number>>({});

//   useEffect(() => {
//     if (!dateFrom || !dateTo) return;

//     const load = async () => {
//       const table = mode === 'views' ? 'published_site_views' : 'site_events';
//       const column = mode === 'views' ? 'viewed_at' : 'created_at';

//       const { data, error } = await supabase
//         .from(table)
//         .select(column)
//         .gte(column, dateFrom)
//         .lte(column, dateTo)
//         .then(({ data, error }) => {
//           if (error) return console.error(error);

//           const filtered = siteId && mode === 'views'
//             ? data.filter((row: any) => row.site_id === siteId)
//             : data;

//           const counts: Record<string, number> = {};
//           for (const row of filtered || []) {
//             const key = row[column as keyof typeof row]?.slice(0, 10); // yyyy-mm-dd
//             counts[key] = (counts[key] || 0) + 1;
//           }
//           setDataByDay(counts);
//         });

//       if (error) return console.error(error);

//       const counts: Record<string, number> = {};
//       for (const row of data || []) {
//         const key = row[column]?.slice(0, 10); // yyyy-mm-dd
//         counts[key] = (counts[key] || 0) + 1;
//       }
//       setDataByDay(counts);
//     };

//     load();
//   }, [dateFrom, dateTo, mode, supabase]);

//   const chartData = {
//     labels: Object.keys(dataByDay),
//     datasets: [
//       {
//         label: mode === 'views' ? 'Page Views' : 'Event Count',
//         data: Object.values(dataByDay),
//         backgroundColor: 'var(--color-accent)',
//       },
//     ],
//   };

//   return (
//     <div className="min-h-screen bg-surface text-text p-6 space-y-6">
//       <h1 className="text-2xl font-bold">📊 Analytics Dashboard</h1>

//       <div className="flex gap-4 items-end">
//         <div>
//           <Label>Site ID</Label>
//           <select
//             value={siteId}
//             onChange={(e) => setSiteId(e.target.value)}
//             className="bg-zinc-800 text-white border border-zinc-600 rounded px-2 py-1"
//           >
//             <option value="">All</option>
//             {siteOptions.map(site => (
//               <option key={site.id} value={site.id}>
//                 {site.domain || site.name || site.id.slice(0, 6)}
//               </option>
//             ))}
//           </select>
//         </div>
//         <div>
//           <Label>Date From</Label>
//           <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
//         </div>
//         <div>
//           <Label>Date To</Label>
//           <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
//         </div>
//         <div>
//           <Label>Mode</Label>
//           <select
//             value={mode}
//             onChange={(e) => setMode(e.target.value as 'views' | 'events')}
//             className="bg-zinc-800 text-white border border-zinc-600 rounded px-2 py-1"
//           >
//             <option value="views">Page Views</option>
//             <option value="events">Events</option>
//           </select>
//         </div>
//       </div>

//       <div className="bg-zinc-900 rounded p-4 shadow">
//         <Bar data={chartData} options={{ responsive: true }} />
//       </div>

//       <button
//         onClick={() => setShowModal(true)}
//         className="mt-4 px-4 py-2 bg-brand text-white rounded hover:opacity-90"
//       >
//         Share / Export
//       </button>

//       <Modal show={showModal} onClose={() => setShowModal(false)}>
//         <h2 className="text-lg font-semibold mb-2">🔗 Share this report</h2>
//         <p className="text-sm text-zinc-300">Coming soon: PDF export, link share, and filters by domain.</p>
//       </Modal>
//     </div>
//   );
// }
