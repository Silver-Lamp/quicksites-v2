// components/admin/FilterDropdown.tsx

interface FilterDropdownProps {
  industry: string;
  setIndustry: (value: string) => void;
}

export default function FilterDropdown({ industry, setIndustry }: FilterDropdownProps) {
  return (
    <div className="space-y-2">
      <label className="text-lg text-gray-300">Filter by Industry:</label>
      <select
        value={industry}
        onChange={(e) => setIndustry(e.target.value)}
        className="bg-gray-700 border border-gray-600 text-white px-3 py-2 text-lg rounded w-full"
      >
        <option value="">All</option>
        <option value="towing">Towing</option>
        <option value="concrete">Concrete</option>
      </select>
    </div>
  );
}
