// components/admin/GridSidebar.tsx
import RevenueEstimator from './revenue-estimator';
import MarkerStats from './marker-stats';
import MapLegend from './map-legend';
import FilterDropdown from './filter-dropdown';

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
