export default function KemptLifeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse pb-24">
      <div className="h-16 bg-white shadow-sm sticky top-0" />
      <div className="max-w-2xl mx-auto px-6 pt-6 space-y-4">
        <div className="h-28 bg-indigo-100 rounded-2xl" />
        <div className="h-16 bg-white rounded-2xl" />
        <div className="h-48 bg-white rounded-2xl" />
        <div className="h-24 bg-white rounded-2xl" />
      </div>
    </div>
  );
}
