export default function TasksLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse pb-24">
      <div className="h-16 bg-white shadow-sm sticky top-0" />
      <div className="max-w-lg mx-auto px-6 pt-4 space-y-3">
        <div className="h-20 bg-white rounded-2xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-white rounded-2xl" />
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-gray-100" />
    </div>
  );
}
