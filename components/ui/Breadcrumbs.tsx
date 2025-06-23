import { useRouter, usePathname } from 'next/navigation';

export default function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname?.split('/').filter(Boolean) || [];

  return (
    <div className="text-sm text-gray-500 mb-4">
      {parts.map((part, idx) => (
        <span key={idx}>
          <span className="capitalize">{part.replace(/[-_]/g, ' ')}</span>
          {idx < parts.length - 1 && ' / '}
        </span>
      ))}
    </div>
  );
}
