export function RewardTally({ points }: { points: number }) {
  const tier = points >= 50 ? '🌟 Steward Elite' : points >= 20 ? '⭐ Steward' : '🎁 Contributor';

  return (
    <div className="bg-zinc-800 rounded px-4 py-3 text-white text-sm inline-block">
      <div className="text-xs text-zinc-400">Reward Tier</div>
      <div className="font-bold">{tier}</div>
      <div className="text-zinc-400">{points} points earned</div>
    </div>
  );
}
