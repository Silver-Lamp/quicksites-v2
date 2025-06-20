import type { SmartLinkItem } from '@/types/SmartLinkItem';

export default function SmartLinkMeta({ item }: { item: SmartLinkItem }) {
  return (
    <span className="text-xs text-zinc-400">
      ({item.id || 'missing'})
      {item.query?.shared && (
        <span className="ml-1 text-green-500" title="Shared">
          🔗
        </span>
      )}
      {item.query?.saved && (
        <span className="ml-1 text-blue-400" title="Saved">
          💾
        </span>
      )}
    </span>
  );
}
