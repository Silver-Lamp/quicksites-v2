import { useEffect, useState } from 'react';

type NavBadgeData = {
  failed?: number;
  new_feedback?: number;
  checkins?: number;
};

export function useNavBadges(initial: NavBadgeData = {}) {
  const [badges, setBadges] = useState<NavBadgeData>(initial);

  useEffect(() => {
    const keys = Object.keys(initial || {});
    if (!keys.length || typeof initial.failed === 'undefined') {
      fetch('/api/nav-badges')
        .then(res => res.json())
        .then(setBadges)
        .catch(() => {});
    }
  }, [initial]);

  return badges;
}
