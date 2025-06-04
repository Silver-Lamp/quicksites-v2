import { useEffect, useState } from 'react';

export default function UpgradePrompt({
  message = "You've reached the limit for guest usage. Create an account to save and continue.",
  returnTo,
  onDismiss
}: {
  message?: string;
  returnTo?: string;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timeout);
  }, []);

  const handleUpgrade = () => {
    if (returnTo) window.location.href = returnTo;
    else window.location.href = '/register';
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 p-6 rounded shadow max-w-sm space-y-4 text-center">
        <h2 className="text-lg font-semibold">Upgrade Required</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
        <div className="flex justify-center gap-4 pt-2">
          <button onClick={handleUpgrade} className="px-4 py-2 bg-blue-600 text-white rounded">Create Account</button>
          <button onClick={() => { setVisible(false); onDismiss?.(); }} className="text-sm text-gray-500 hover:underline">Dismiss</button>
        </div>
      </div>
    </div>
  );
}
