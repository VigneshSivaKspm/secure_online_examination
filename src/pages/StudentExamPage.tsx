import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ProctoringMonitor from '../components/ProctoringMonitor';

/**
 * StudentExamPage - Complete example integration of proctoring
 * 
 * Shows:
 * - Proctoring monitor on the side
 * - Exam content in main area
 * - Alert handling
 * - Time tracking
 */
export const StudentExamPage: React.FC<{ examId: string }> = ({ examId }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<string[]>([]);
  const [timeLeft] = useState(3600); // 1 hour
  const [examSubmitted, setExamSubmitted] = useState(false);

  if (!user || user.role !== 'student') {
    return <div>Not authorized</div>;
  }

  const handleAlertTriggered = (alert: string) => {
    setAlerts((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${alert}`]);
  };

  const handleSubmitExam = async () => {
    // Save exam submission with alert data
    setExamSubmitted(true);
    console.log('Exam submitted with', alerts.length, 'alerts');
  };

  return (
    <div className="flex gap-4 p-4 bg-gray-50 min-h-screen">
      {/* Main Exam Area */}
      <div className="flex-1 bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Exam: {examId}</h1>

        {examSubmitted && (
          <div className="bg-green-50 border border-green-200 p-4 mb-4 rounded">
            <p className="text-green-800 font-semibold">✓ Exam submitted successfully</p>
          </div>
        )}

        {alerts.length > 3 && (
          <div className="bg-red-50 border border-red-200 p-4 mb-4 rounded">
            <p className="text-red-800 font-semibold">⚠ Multiple suspicious activities detected</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 p-6 rounded mb-6">
          <p className="text-blue-900">📝 This is a demo integration page. Use ExamRoom component for the actual exam experience.</p>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleSubmitExam}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Submit Exam
          </button>
        </div>
      </div>

      {/* Proctoring Sidebar */}
      <div className="w-96">
        <div className="sticky top-4 space-y-4">
          <ProctoringMonitor
            studentId={user.uid}
            examId={examId}
            enabled={!examSubmitted}
            onAlertTriggered={handleAlertTriggered}
          />

          {/* Alert Log */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 mb-2">Alert Log ({alerts.length})</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto bg-gray-50 p-2 rounded">
              {alerts.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No alerts yet</p>
              ) : (
                alerts.map((alert, idx) => (
                  <div key={idx} className="text-xs text-red-700 border-b border-gray-200 pb-1">
                    {alert}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Time Remaining */}
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 mb-1">Time Remaining</p>
            <p className="text-2xl font-bold text-gray-900">
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentExamPage;
