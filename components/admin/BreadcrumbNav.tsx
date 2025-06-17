// components/BreadcrumbNav.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function BreadcrumbNav() {
  const router = useRouter();
  const segments = router.asPath.split('?')[0].split('/').filter(Boolean);

  const pathAcc: string[] = [];
  const crumbs = segments.map((seg, i) => {
    pathAcc.push(seg);
    const href = '/' + pathAcc.join('/');
    const label = seg
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
    return (
      <span key={i} className="text-sm text-gray-500">
        {i > 0 && ' / '}
        <Link href={href} className="hover:underline text-blue-600">
          {label}
        </Link>
      </span>
    );
  });

  return <div className="mb-2">{crumbs}</div>;
}
