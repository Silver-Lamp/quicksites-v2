import SmartLink from './smart-link';
import SmartLinkMeta from './smart-link-meta';
import { Tooltip } from '../ui/tooltip';
import type { SmartLinkItem } from '../../types/SmartLinkItem';

export default function SmartLinkGallery({ items }: { items: SmartLinkItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-2">
          <SmartLink id={item.id} type={item.type} query={item.query} theme={item.theme} href={''}>
            {item.label || `${item.type} link`}
            <span className="ml-2">
              <Tooltip content="Shared or Saved Metadata">
                <SmartLinkMeta item={item} />
              </Tooltip>
            </span>
          </SmartLink>
        </li>
      ))}
    </ul>
  );
}
