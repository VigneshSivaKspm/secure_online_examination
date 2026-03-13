import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { FinalExamResult } from '../services/examService';

/**
 * ResultsPage Component
 *
 * Displays comprehensive exam results including:
 * - Score and percentage
 * - Proctoring status (GREEN/YELLOW/RED)
 * - AI-generated feedback for wrong answers
 * - Proctoring history and alerts
 * - Performance analysis
 */
export const ResultsPage: React.FC = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<FinalExamResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load result from Firebase on mount
   */
  useEffect(() => {
    const loadResult = async () => {
      if (!resultId || !user) {
        navigate('/student-dashboard');
        return;
      }

      try {
        const resultDoc = await getDoc(doc(db, 'exam_results', resultId));

        if (!resultDoc.exists()) {
          alert('Result not found');
          navigate('/student-dashboard');
          return;
        }

        const data = resultDoc.data();
        setResult({
          resultId,
          studentId: data.studentId,
          examId: data.examId,
          sessionId: data.sessionId,
          score: data.score,
          totalPoints: data.totalPoints,
          percentage: data.percentageScore,
          aiFeedback: data.aiFeedback || [],
          proctorLog: data.proctorLog || [],
          proctorStatus: data.proctorStatus || 'GREEN',
          submittedAt: data.submittedAt?.toDate() || new Date(),
          timeTaken: data.timeTaken,
        } as FinalExamResult);
      } catch (error) {
        console.error('Error loading result:', error);
        alert('Failed to load results');
        navigate('/student-dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadResult();
  }, [resultId, user, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">Results not found</p>
        </div>
      </div>
    );
  }

  /**
   * Determine score emoji and color
   */
  const getScoreEmoji = (): string => {
    if (result.percentage >= 80) return '🎉';
    if (result.percentage >= 60) return '✓';
    return '📋';
  };

  const getScoreColor = (): string => {
    if (result.percentage >= 80) return 'text-green-600';
    if (result.percentage >= 60) return 'text-blue-600';
    return 'text-orange-600';
  };

  const getScoreBgColor = (): string => {
    if (result.percentage >= 80) return 'bg-green-50';
    if (result.percentage >= 60) return 'bg-blue-50';
    return 'bg-orange-50';
  };

  /**
   * Get proctoring status display
   */
  const getProctoringDisplay = (): { icon: string; color: string; text: string; bgColor: string } => {
    switch (result.proctorStatus) {
      case 'GREEN':
        return {
          icon: '✓',
          color: 'text-green-600',
          text: 'Clean Exam Session',
          bgColor: 'bg-green-50 border-green-200',
        };
      case 'YELLOW':
        return {
          icon: '⚠',
          color: 'text-yellow-600',
          text: 'Some Suspicious Activity',
          bgColor: 'bg-yellow-50 border-yellow-200',
        };
      case 'RED':
        return {
          icon: '✗',
          color: 'text-red-600',
          text: 'Multiple Alerts Detected',
          bgColor: 'bg-red-50 border-red-200',
        };
      default:
        return {
          icon: '?',
          color: 'text-gray-600',
          text: 'Unknown Status',
          bgColor: 'bg-gray-50 border-gray-200',
        };
    }
  };

  const proctoring = getProctoringDisplay();

  /**
   * Format time for display
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  /**
   * Format date
   */
  const formatDate = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Exam Results</h1>
              <p className="text-gray-600 mt-1">
                {formatDate(result.submittedAt)}
              </p>
            </div>
            <div className="text-5xl">{getScoreEmoji()}</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Score Card */}
        <div className={`${getScoreBgColor()} border border-gray-200 rounded-lg p-8`}>
          <div className="text-center">
            <p className="text-gray-600 text-sm font-semibold uppercase mb-2">Your Score</p>
            <p className={`text-6xl font-bold ${getScoreColor()} mb-2`}>
              {result.percentage.toFixed(1)}%
            </p>
            <p className="text-xl text-gray-700">
              {result.score} out of {result.totalPoints} points
            </p>
          </div>
        </div>

        {/* Proctoring Status */}
        <div className={`border-2 ${proctoring.bgColor} rounded-lg p-6`}>
          <div className="flex items-start gap-4">
            <div className={`text-4xl ${proctoring.color}`}>{proctoring.icon}</div>
            <div className="flex-1">
              <h3 className={`text-xl font-bold ${proctoring.color} mb-1`}>
                {proctoring.text}
              </h3>
              <p className="text-gray-700 mb-3">
                {result.proctorLog.length === 0
                  ? 'No suspicious activity detected during exam.'
                  : `${result.proctorLog.length} alert${result.proctorLog.length !== 1 ? 's' : ''} recorded during exam.`}
              </p>

              {result.proctorLog.length > 0 && (
                <div className="bg-white rounded p-3 text-sm text-gray-600">
                  <strong>Alert Summary:</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {result.proctorLog.slice(0, 3).map((log, idx) => (
                      <li key={idx}>{log.reason}</li>
                    ))}
                    {result.proctorLog.length > 3 && (
                      <li className="text-gray-500">{`...and ${result.proctorLog.length - 3} more`}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Time Taken</p>
            <p className="text-2xl font-bold text-gray-900">{formatTime(result.timeTaken)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Status</p>
            <p className={`text-2xl font-bold ${proctoring.color}`}>
              {result.proctorStatus}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Alerts</p>
            <p className="text-2xl font-bold text-gray-900">{result.proctorLog.length}</p>
          </div>
        </div>

        {/* AI Feedback Section */}
        {result.aiFeedback.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-blue-50 border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                📚 Learning Feedback ({result.aiFeedback.length} {result.aiFeedback.length === 1 ? 'question' : 'questions'})
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                AI-generated explanations for incorrect answers
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {result.aiFeedback.map((item, idx) => (
                <div key={item.questionId} className="p-6">
                  {/* Question */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 font-semibold uppercase mb-1">
                      Question {idx + 1}
                    </p>
                    <p className="text-gray-900 font-semibold">{item.questionText}</p>
                  </div>

                  {/* Answer Comparison */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-red-50 rounded p-3">
                      <p className="text-xs text-red-700 font-semibold mb-1">Your Answer</p>
                      <p className="text-red-900">{item.studentAnswer}</p>
                    </div>
                    <div className="bg-green-50 rounded p-3">
                      <p className="text-xs text-green-700 font-semibold mb-1">Correct Answer</p>
                      <p className="text-green-900">{item.correctAnswer}</p>
                    </div>
                  </div>

                  {/* AI Feedback */}
                  <div className="bg-blue-50 border border-blue-200 rounded p-4">
                    <div className="flex gap-2">
                      <span className="text-lg flex-shrink-0">💡</span>
                      <div className="flex-1">
                        <p className="text-xs text-blue-700 font-semibold uppercase mb-1">
                          Learning Tip
                        </p>
                        <p className="text-blue-900">{item.feedback}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Analysis */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Performance Analysis</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Questions Answered Correctly</span>
              <span className="font-bold text-gray-900">
                {result.totalPoints - result.aiFeedback.reduce((sum, f) => sum + (f ? 1 : 0), 0)}/{result.totalPoints}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700">Questions Answered Incorrectly</span>
              <span
                className={`font-bold ${result.aiFeedback.length === 0 ? 'text-green-600' : 'text-orange-600'}`}
              >
                {result.aiFeedback.length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700">Success Rate</span>
              <span className={`font-bold ${result.percentage >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                {result.percentage.toFixed(1)}%
              </span>
            </div>

            {result.proctorLog.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Proctoring Alerts</span>
                <span
                  className={`font-bold ${result.proctorLog.length === 0 ? 'text-green-600' : result.proctorLog.length <= 2 ? 'text-blue-600' : 'text-red-600'}`}
                >
                  {result.proctorLog.length}
                </span>
              </div>
            )}
          </div>

          {/* Performance Message */}
          <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-blue-900">
              {result.percentage >= 80
                ? '🎉 Excellent performance! You have mastered this material.'
                : result.percentage >= 60
                  ? '👍 Good job! Review the feedback above to improve further.'
                  : '📚 Keep practicing! Focus on the topics marked above.'}
            </p>
          </div>
        </div>

        {/* Proctoring Details */}
        {result.proctorLog.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🎥 Proctoring History</h3>

            <div className="space-y-2">
              {result.proctorLog.map((log, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                  <span className="text-lg flex-shrink-0">
                    {log.severity === 'critical' ? '🚨' : '⚠️'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{log.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center py-8">
          <button
            onClick={() => navigate('/student-dashboard')}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition"
          >
            Back to Dashboard
          </button>


        </div>
      </div>

      {/* Footer Note */}
      <div className="bg-gray-100 border-t border-gray-200 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-gray-600">
          <p>
            This exam was proctored using AI-powered facial recognition and behavioral monitoring.
            All results are recorded and available for your teacher's review.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
