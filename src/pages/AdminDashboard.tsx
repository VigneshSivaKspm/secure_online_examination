import { Navbar } from '../components/Navbar';

export function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Teacher Dashboard</h2>
            <p className="text-gray-600 mb-4">
              Welcome to the Admin/Teacher dashboard. Here you can manage exams, view results, and monitor student progress.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900">Total Exams</h3>
                <p className="text-3xl font-bold text-indigo-600 mt-2">0</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900">Total Students</h3>
                <p className="text-3xl font-bold text-indigo-600 mt-2">0</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900">Avg Score</h3>
                <p className="text-3xl font-bold text-indigo-600 mt-2">--</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
