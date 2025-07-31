// app/claim-success/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';

export default function ClaimSuccessPage() {
  const searchParams = useSearchParams();
  const domain = searchParams.get('domain');

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <h1 className="text-3xl font-bold mb-4">🎉 Success!</h1>
      <p className="mb-4 text-lg">
        You’ve claimed <strong>{domain}</strong>.
      </p>
      <p className="text-sm text-gray-600">
        We’ve sent a confirmation to your email and will reach out with setup instructions shortly.
      </p>
    </div>
  );
}
