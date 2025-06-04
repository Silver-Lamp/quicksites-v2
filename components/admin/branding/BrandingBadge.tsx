export default function BrandingBadge({ branding }: { branding: any }) {
  if (!branding) return null;

  const themeColors: any = {
    dark: 'bg-gray-800 text-white border-gray-700',
    light: 'bg-white text-black border-gray-300'
  };

  const brandColors: any = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500'
  };

  return (
    <div className={`text-xs inline-flex items-center gap-2 px-2 py-1 rounded border ${themeColors[branding.theme] || ''}`}>
      <span>{branding.name}</span>
      <div className={`w-3 h-3 rounded-full ${brandColors[branding.brand] || ''}`} />
      {branding.logo_url && (
        <img src={branding.logo_url} alt="Logo" className="h-4 w-4 rounded-full" />
      )}
    </div>
  );
}
