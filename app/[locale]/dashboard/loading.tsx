export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="h-16 bg-white shadow-sm" />
      <div className="max-w-lg mx-auto px-6 pt-6 space-y-4">
        <div className="h-32 bg-white rounded-2xl" />
        <div className="h-24 bg-white rounded-2xl" />
        <div className="h-24 bg-white rounded-2xl" />
        <div className="h-24 bg-white rounded-2xl" />
      </div>
    </div>
  );
}
