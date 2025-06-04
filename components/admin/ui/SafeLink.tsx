import Link from 'next/link';

export default function SafeLink({
  href,
  children,
  className
}: {
  href: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  if (!href || href === 'undefined') {
    console.warn('⚠️ SafeLink: attempted to render <Link> with undefined href.');
    return <span className="text-red-500">{children}</span>;
  }

  return <Link href={href} className={className}>{children}</Link>;
}
