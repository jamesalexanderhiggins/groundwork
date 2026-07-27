import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">🗺️</div>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/dashboard"
        className="px-6 py-3 bg-indigo-500 text-white rounded-2xl font-semibold"
      >
        Go home
      </Link>
    </div>
  );
}
