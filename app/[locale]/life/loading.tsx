export default function KemptLifeLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-16">
      <div className="h-[76px] bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] sticky top-0" />
      <div className="max-w-2xl mx-auto px-6 pt-6 flex flex-col gap-4">
        <div className="skeleton h-28 rounded-[var(--border-radius)]" />
        <div className="skeleton h-16 rounded-[var(--border-radius)]" />
        <div className="skeleton h-48 rounded-[var(--border-radius)]" />
        <div className="skeleton h-24 rounded-[var(--border-radius)]" />
      </div>
      <span className="sr-only" role="status">Loading your life admin</span>
    </div>
  );
}
