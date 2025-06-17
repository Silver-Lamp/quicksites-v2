export function getBadgeForReferrals(
  count: number
): { icon: string; title: string } | null {
  if (count >= 50) return { icon: '💎', title: 'Beacon Leader' };
  if (count >= 10) return { icon: '🏅', title: 'Signal Steward' };
  if (count >= 1) return { icon: '🎖', title: 'Early Referrer' };
  return null;
}
