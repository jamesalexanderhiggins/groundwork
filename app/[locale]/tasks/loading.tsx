export default function TasksLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-nav">
      <div className="h-[68px] bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] sticky top-0" />
      <div className="max-w-lg mx-auto px-6 pt-4 flex flex-col gap-3">
        <div className="skeleton h-20 rounded-[var(--border-radius)]" />
        <div className="h-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-[var(--border-radius)]" />
        ))}
      </div>
      <span className="sr-only" role="status">Loading today&apos;s tasks</span>
    </div>
  );
}
