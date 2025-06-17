// components/admin/MapLegend.tsx

export default function MapLegend() {
  return (
    <div className="space-x-4 text-base">
      <span className="inline-block w-4 h-4 bg-yellow-400 rounded-full"></span>{' '}
      1 Lead
      <span className="inline-block w-4 h-4 bg-orange-500 rounded-full"></span>{' '}
      2+ Leads
      <span className="inline-block w-4 h-4 bg-blue-500 rounded-full"></span> 1+
      Domain
      <span className="inline-block w-4 h-4 bg-green-500 rounded-full"></span>{' '}
      Lead + Domain
    </div>
  );
}
