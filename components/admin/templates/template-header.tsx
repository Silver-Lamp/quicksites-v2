// import Link from 'next/link';
import { SafeLink } from '@/components/ui';

type TemplateHeaderProps = {
  name: string;
  updatedAt?: string;
  duplicateUrl: string;
  template: any;
};

export default function TemplateHeader({ name, updatedAt, duplicateUrl }: TemplateHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div>
        <h3 className="text-lg font-semibold">{name}</h3>
        {updatedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>
      <SafeLink href={duplicateUrl}>
        <button className="text-sm text-blue-500 hover:underline">Duplicate Template</button>
      </SafeLink>
    </div>
  );
}
