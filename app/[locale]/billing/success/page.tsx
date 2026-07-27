import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  if (!params.session_id) redirect('/billing');

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-6xl mb-4">🎉</p>
        <h1 className="font-bold text-2xl text-gray-900 mb-2">You&apos;re in!</h1>
        <p className="text-gray-500 mb-6">
          Your subscription is active. Everything is unlocked.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-indigo-600 text-white font-semibold rounded-xl px-6 py-3 hover:bg-indigo-700 transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
