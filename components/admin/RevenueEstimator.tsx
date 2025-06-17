// components/admin/RevenueEstimator.tsx

interface RevenueEstimatorProps {
  filteredPoints: any[];
}

export default function RevenueEstimator({
  filteredPoints,
}: RevenueEstimatorProps) {
  const revenue = filteredPoints.reduce((sum, p) => {
    if (p.leads >= 2 && p.domains > 0) return sum + 49 * 1.0;
    if (p.leads >= 2) return sum + 49 * 0.75;
    if (p.leads === 2) return sum + 49 * 0.5;
    if (p.leads === 1) return sum + 49 * 0.25;
    return sum;
  }, 0);

  return (
    <div className="p-4 border border-green-700 rounded bg-black/30">
      <h2 className="text-2xl font-bold text-green-400 mb-2">
        💼 Revenue Opportunity
      </h2>
      <p className="text-xl text-green-200">${revenue.toFixed(2)} / month</p>
    </div>
  );
}
