// components/admin/GridSidebar.tsx
import RevenueEstimator from './RevenueEstimator';
import MarkerStats from './MarkerStats';
import MapLegend from './MapLegend';
import FilterDropdown from './FilterDropdown';

interface GridSidebarProps {
  industry: string;
  setIndustry: (value: string) => void;
  filteredPoints: any[];
}

export default function GridSidebar({ industry, setIndustry, filteredPoints }: GridSidebarProps) {
  return (
    <div className="space-y-4">
      <FilterDropdown industry={industry} setIndustry={setIndustry} />
      <RevenueEstimator filteredPoints={filteredPoints} />
      <MarkerStats filteredPoints={filteredPoints} />
      <MapLegend />
    </div>
  );
}
