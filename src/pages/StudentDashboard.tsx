import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { fetchAvailableExams, fetchStudentResults, fetchStudentStats, fetchExamTitles } from '../services/examService';

interface ExamData {
  id: string;
  title: string;
  duration: string;
  questions: number;
  status: 'Not Started' | 'Completed';
  score?: string;
  startAt?: Date | null;
  endAt?: Date | null;
}

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'available' | 'completed'>('available');
  const [availableExams, setAvailableExams] = useState<ExamData[]>([]);
  const [completedExams, setCompletedExams] = useState<ExamData[]>([]);
  const [stats, setStats] = useState({ averageScore: 0, completedCount: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleStartExam = (examId: string) => {
    navigate(`/exam/${examId}`);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user?.uid) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch student results first to get completed exam IDs
        const results = await fetchStudentResults(user.uid);
        const completedExamIds = new Set(results.map((r) => r.examId));
        const examTitles = await fetchExamTitles(results.map((r) => r.examId));

        // Fetch available exams and filter out completed ones
        const exams = await fetchAvailableExams();
        const formattedAvailable: ExamData[] = exams
          .filter(exam => !completedExamIds.has(exam.id)) // Hide completed exams
          .map((exam) => ({
            id: exam.id,
            title: exam.title,
            duration: exam.duration,
            questions: exam.questions,
            status: 'Not Started',
            startAt: exam.startAt ?? null,
            endAt: exam.endAt ?? null,
          }));
        setAvailableExams(formattedAvailable);

        // Format completed exams
        const formattedCompleted: ExamData[] = results.map((result) => ({
          id: result.id,
          title: examTitles[result.examId] || 'Unknown Exam',
          duration: '',
          questions: 0,
          status: 'Completed',
          score: `${Math.round(result.percentageScore)}%`,
        }));
        setCompletedExams(formattedCompleted);

        // Fetch student stats
        const fetchedStats = await fetchStudentStats(user.uid);
        setStats(fetchedStats);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.uid]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 hidden md:block overflow-y-auto">
          <div className="p-6 text-center border-b border-gray-100">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              {user?.displayName?.[0] || 'S'}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{user?.displayName || 'Student Name'}</h2>
            <p className="text-xs text-gray-500 font-medium">Student Account</p>
          </div>
          
          <nav className="p-4 space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-3">
              Dashboard
            </h2>
            <button
              onClick={() => setActiveTab('available')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'available'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              📝 Available Exams
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'completed'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              ✅ Completed
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                {activeTab === 'available' && 'Ready to start?'}
                {activeTab === 'completed' && 'Your Progress'}
              </h1>
              <p className="text-gray-500 text-lg mt-1 font-medium italic">
                {activeTab === 'available' && 'Select an examination from your list below'}
                {activeTab === 'completed' && 'Review your previous examination scores'}
              </p>
            </div>

            {/* Quick Stats */}
            {activeTab === 'available' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center text-xl">⏳</div>
                  <div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-tight">Active</p>
                    <p className="text-2xl font-black text-gray-900">{availableExams.length} Exams</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="bg-green-50 w-12 h-12 rounded-xl flex items-center justify-center text-xl">🏆</div>
                  <div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-tight">Avg. Score</p>
                    <p className="text-2xl font-black text-gray-900">{stats.averageScore}%</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center text-xl">🚀</div>
                  <div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-tight">Streak</p>
                    <p className="text-2xl font-black text-gray-900">{stats.streak} Days</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {loading && (
                <div className="text-center py-12">
                  <p className="text-gray-500 font-medium">Loading dashboard data...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {!loading && !error && activeTab === 'available' && (
                <>
                  {availableExams.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                      <p className="text-gray-500 font-medium">No exams available at the moment</p>
                    </div>
                  ) : (
                    availableExams.map((exam) => {
                      const now = new Date();
                      const isScheduled = exam.startAt != null && exam.endAt != null;
                      const notYetStarted = isScheduled && now < exam.startAt!;
                      const windowClosed = isScheduled && now > exam.endAt!;
                      const canStart = !notYetStarted && !windowClosed;

                      return (
                        <div key={exam.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-indigo-300 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-1 leading-tight group-hover:text-indigo-600 transition-colors">{exam.title}</h3>
                            <div className="flex flex-wrap gap-4 text-sm font-bold text-gray-500 mt-1">
                              {exam.startAt && (
                                <span className="flex items-center gap-1">📅 Starts: {exam.startAt.toLocaleString()}</span>
                              )}
                              {exam.endAt && (
                                <span className="flex items-center gap-1">⏰ Ends: {exam.endAt.toLocaleString()}</span>
                              )}
                              {!exam.startAt && (
                                <span className="flex items-center gap-1">⏱️ {exam.duration}</span>
                              )}
                              <span className="flex items-center gap-1">📝 {exam.questions} Questions</span>
                            </div>
                            {isScheduled && (
                              <p className={`text-xs font-bold mt-2 ${
                                notYetStarted ? 'text-yellow-600' : windowClosed ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {notYetStarted ? '⏳ Exam window not yet open' : windowClosed ? '❌ Exam window has closed' : '✅ Exam window is open'}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => canStart && handleStartExam(exam.id)}
                            disabled={!canStart}
                            className={`px-8 py-3 rounded-xl font-bold transition-all ${
                              canStart
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {notYetStarted ? 'Not Yet Open' : windowClosed ? 'Closed' : 'Start Exam'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {!loading && !error && activeTab === 'completed' && (
                <>
                  {completedExams.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                      <p className="text-gray-500 font-medium">No completed exams yet</p>
                    </div>
                  ) : (
                    completedExams.map((exam) => (
                      <div key={exam.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{exam.title}</h3>
                          <p className="text-sm text-gray-500 font-medium">Completed on {new Date(exam.id).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-green-600">{exam.score}</p>
                          <button className="text-indigo-600 text-xs font-bold hover:underline">View Report</button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}


            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export { StudentDashboard };