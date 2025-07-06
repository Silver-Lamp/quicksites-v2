// components/admin/GridSidebar.tsx
import { useState, useEffect } from 'react';
import RevenueEstimator from './revenue-estimator';
import MarkerStats from './marker-stats';
import MapLegend from './map-legend';
import FilterDropdown from './filter-dropdown';
import type { CityPoint } from '@/types/grid';

interface GridSidebarProps {
  industry: string;
  setIndustry: (value: string) => void;
  filteredPoints: CityPoint[];
  showHotspotsOnly?: boolean;
  setShowHotspotsOnly?: (v: boolean) => void;
}

export default function GridSidebar({
  industry,
  setIndustry,
  filteredPoints,
  showHotspotsOnly: externalShowHotspotsOnly,
  setShowHotspotsOnly: externalSetShowHotspotsOnly,
}: GridSidebarProps) {
  const [internalShowHotspotsOnly, setInternalShowHotspotsOnly] = useState(true);

  const showHotspotsOnly = externalShowHotspotsOnly ?? internalShowHotspotsOnly;
  const setShowHotspotsOnly = externalSetShowHotspotsOnly ?? setInternalShowHotspotsOnly;

  const visiblePoints = showHotspotsOnly
    ? filteredPoints.filter((p) => p.has2PlusUnclaimedInSameIndustry)
    : filteredPoints;

  useEffect(() => {
    console.log('[🔍 Visible Hotspots]', visiblePoints.map(p => ({
      city: p.city,
      state: p.state,
      unclaimed: p.unclaimedLeadCount,
      has2PlusUnclaimedInSameIndustry: p.has2PlusUnclaimedInSameIndustry,
    })));
  }, [visiblePoints]);

  return (
    <div className="space-y-4">
      <FilterDropdown industry={industry} setIndustry={setIndustry} />
      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={showHotspotsOnly}
          onChange={(e) => setShowHotspotsOnly(e.target.checked)}
        />
          Show Hotspots Only
        </label>
      </div>
      {/* <RevenueEstimator filteredPoints={visiblePoints} /> */}
      {/* <MarkerStats filteredPoints={visiblePoints} /> */}
      {/* <MapLegend /> */}
    </div>
  );
}
