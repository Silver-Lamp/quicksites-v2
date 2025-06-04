import SmartLink from './SmartLink';
import SmartLinkMeta from './SmartLinkMeta';
import Tooltip from './Tooltip';
import type { SmartLinkItem } from '@/admin/types/SmartLinkItem';



export default function SmartLinkGallery({ items }: { items: SmartLinkItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-2">
          <SmartLink
            id={item.id}
            type={item.type}
            query={item.query}
            theme={item.theme}
          >
            {item.label || `${item.type} link`}
            <span className="ml-2">
              <Tooltip content="Shared or Saved Metadata">
                  <SmartLinkMeta item={item} />
                </Tooltip>
          </SmartLink>
        </li>
      ))}
    </ul>
  );
}
