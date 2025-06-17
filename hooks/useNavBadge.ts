import { useEffect, useState } from 'react';

export function useNavBadge(initial = { failed: 0 }) {
  const [navBadges, setNavBadges] = useState(initial);

  useEffect(() => {
    if (!initial || typeof initial.failed === 'undefined') {
      fetch('/api/nav-badges')
        .then((res) => res.json())
        .then(setNavBadges)
        .catch(() => {});
    }
  }, [initial]);

  return navBadges;
}
