import { RewardTally } from '@/components/reward-tally';
import { json } from '@/lib/api/json';
import { useUser } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';

export default function Profile() {
  const user = useUser();
  const [points, setPoints] = useState(0);
  const [refLink, setRefLink] = useState('');

  useEffect(() => {
    if (user) {
      fetch(`/api/reward-points?user_id=${user.id}`)
        .then((res) => res.json())
        .then((d) => setPoints(d.total || 0));
      setRefLink(`${window.location.origin}/?ref=${user.id}`);
    }
  }, [user]);

  return (
    <div className="max-w-xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">👤 Profile</h1>
      {user && (
        <>
          <div className="mb-6">
            <RewardTally points={points} />
          </div>
          <div className="bg-zinc-800 p-4 rounded text-sm">
            <div className="text-zinc-400 mb-1">Your referral link:</div>
            <code className="text-blue-400">{refLink}</code>
          </div>
        </>
      )}
    </div>
  );
}
