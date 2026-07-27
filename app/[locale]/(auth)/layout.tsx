export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">Kempt</h1>
          <p className="text-sm mt-1 opacity-60 text-[var(--color-text)]">Your family&apos;s life OS</p>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] shadow-lg p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
