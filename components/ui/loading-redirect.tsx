'use client';

import React from 'react';

type LoadingRedirectProps = {
  message?: string;
};

export default function LoadingRedirect({ message = 'Redirecting...' }: LoadingRedirectProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
