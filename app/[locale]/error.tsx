'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">⚡</div>
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        An unexpected error occurred. Your data is safe.
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-indigo-500 text-white rounded-2xl font-semibold"
      >
        Try again
      </button>
    </div>
  );
}
