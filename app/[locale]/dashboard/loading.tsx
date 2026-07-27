export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="h-[76px] bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)]" />
      <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-6">
        <div className="skeleton h-44 rounded-[var(--border-radius)]" />
        <div className="skeleton h-28 rounded-[var(--border-radius)]" />
        <div className="skeleton h-36 rounded-[var(--border-radius)]" />
        <div className="skeleton h-48 rounded-[var(--border-radius)]" />
      </div>
      <span className="sr-only" role="status">Loading your dashboard</span>
    </div>
  );
}
