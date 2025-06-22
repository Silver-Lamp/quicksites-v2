import Link from 'next/link';

type SafeLinkProps = {
  href: string | undefined;
  children: React.ReactNode;
  className?: string;
  target?: string;
  title?: string;
  onClick?: () => void;
};

export default function SafeLink({
  href,
  children,
  className,
  target,
  title,
  onClick,
}: SafeLinkProps) {
  if (!href || href === 'undefined') {
    console.warn('⚠️ SafeLink: attempted to render <Link> with undefined href.');
    return <span className="text-red-500">{children}</span>;
  }

  return (
    <Link href={href} className={className} target={target} title={title} onClick={onClick}>
      {children}
    </Link>
  );
}
