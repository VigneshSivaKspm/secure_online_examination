import type { StudentResult } from '../types/exam';

interface ResultsTableProps {
  examId: string;
  results: StudentResult[];
  loading?: boolean;
}

export function ResultsTable({ examId, results, loading = false }: ResultsTableProps) {
  const getProctorColor = (flag: string) => {
    switch (flag) {
      case 'green':
        return 'bg-green-100 text-green-800';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800';
      case 'red':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProctorLabel = (flag: string) => {
    switch (flag) {
      case 'green':
        return '✓ Clean';
      case 'yellow':
        return '⚠ Suspicious';
      case 'red':
        return '✕ Flagged';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-xl text-gray-600">Loading results...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No results available yet for this exam.</p>
      </div>
    );
  }

  const averageScore = (results.reduce((sum, r) => sum + r.percentageScore, 0) / results.length).toFixed(1);
  const flaggedCount = results.filter(r => r.proctorFlag === 'red').length;

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-600 font-medium">Total Submissions</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">{results.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-green-600 font-medium">Average Score</p>
          <p className="text-3xl font-bold text-green-900 mt-1">{averageScore}%</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-sm text-red-600 font-medium">Flagged Results</p>
          <p className="text-3xl font-bold text-red-900 mt-1">{flaggedCount}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-purple-600 font-medium">Exam ID</p>
          <p className="text-lg font-mono text-purple-900 mt-1 truncate">{examId.slice(0, 12)}...</p>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Student Name</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Score</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Percentage</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Time Taken</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Proctoring Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr
                key={result.id}
                className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                  result.proctorFlag === 'red' ? 'bg-red-50' : ''
                }`}
              >
                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                  {result.studentName}
                  <span className="text-xs text-gray-500 ml-2">({result.studentId})</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-900 font-bold">
                    {result.score}/{result.totalPoints}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                    result.percentageScore >= 80
                      ? 'bg-green-100 text-green-800'
                      : result.percentageScore >= 60
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.percentageScore}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-600">
                  {formatTime(result.timeTaken)}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getProctorColor(result.proctorFlag)}`}>
                    <span className="mr-2">{result.proctorFlag === 'green' ? '✓' : result.proctorFlag === 'red' ? '✕' : '⚠'}</span>
                    {getProctorLabel(result.proctorFlag)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {result.submittedAt.toLocaleDateString()} {result.submittedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Proctoring Status Legend:</strong>
        </p>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-gray-700"><strong>Green:</strong> Normal behavior detected</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full"></span>
            <span className="text-gray-700"><strong>Yellow:</strong> Minor suspicious activities</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
            <span className="text-gray-700"><strong>Red:</strong> Multiple red flags detected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
