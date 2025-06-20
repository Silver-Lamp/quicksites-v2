import SmartLink from '@/components/admin/SmartLink';
import SmartLinkMeta from '@/components/admin/SmartLinkMeta';
import Tooltip from '@/components/admin/Tooltip';
import type { SmartLinkItem } from '@/types/SmartLinkItem';
export default function SmartLinkGrid({ items }: { items: SmartLinkItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map((item, i) => (
        <div key={i} className="border rounded bg-zinc-900 p-3">
          <SmartLink id={item.id} type={item.type} query={item.query} theme={item.theme} href={''}>
            <div className="font-medium text-white mb-1">{item.label || `${item.type} link`}</div>
            <Tooltip content="Shared or Saved Metadata">
              <SmartLinkMeta item={item} />
            </Tooltip>
          </SmartLink>
        </div>
      ))}
    </div>
  );
}
