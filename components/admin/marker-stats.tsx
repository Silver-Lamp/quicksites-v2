// components/admin/MarkerStats.tsx

interface MarkerStatsProps {
  filteredPoints: any[];
}

export default function MarkerStats({ filteredPoints }: MarkerStatsProps) {
  const yellow = filteredPoints.filter((p) => p.leads === 1 && p.domains === 0).length;
  const orange = filteredPoints.filter((p) => p.leads >= 2 && p.domains === 0).length;
  const blue = filteredPoints.filter((p) => p.leads === 0 && p.domains > 0).length;
  const green = filteredPoints.filter((p) => p.leads >= 2 && p.domains > 0).length;

  return (
    <div className="text-lg text-gray-300">
      Visible Markers — 🟡 {yellow} 🟠 {orange} 🔵 {blue} 🟢 {green}
    </div>
  );
}
