import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useProctoring } from '../hooks/useProctoring';
import { useNotifications } from '../hooks/useNotifications';
import ProctoringMonitor from './ProctoringMonitor';
import SuspiciousActivityPopup from './SuspiciousActivityPopup';
import ScreenLockOverlay from './ScreenLockOverlay';
import { db } from '../config/firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import {
  fetchRandomExamQuestions,
  calculateFinalResult,
  saveProgressToLocalStorage,
  loadProgressFromLocalStorage,
  clearProgressFromLocalStorage,
} from '../services/examService';
import type { StudentAnswers } from '../services/examService';
import {
  registerStudentSession,
  updateSessionStatus,
  endStudentSession,
} from '../services/chatService';
import type { ExamQuestion } from '../types/exam';
import type { ProctoringStatus, ProctoringStatusType } from '../types/proctoring';

interface ExamRoomProps {
  examId: string;
  sessionId?: string;
}

/**
 * ExamRoom Component
 *
 * Complete exam-taking interface with:
 * - Question display with answer selection
 * - 30-minute countdown timer
 * - Real-time proctoring with camera
 * - Auto-save progress to local storage
 * - Suspicious activity detection
 * - Auto-submit on timer end or manual submit
 */
export const ExamRoom: React.FC<ExamRoomProps> = ({ examId, sessionId: providedSessionId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<StudentAnswers>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [showSuspiciousWarning, setShowSuspiciousWarning] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarningPopup, setShowWarningPopup] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  // Handle warning threshold reached (3 warnings)
  const handleWarningThresholdReached = useCallback((count: number) => {
    setWarningCount(count);
    setShowWarningPopup(true);
    console.warn('🚨 CRITICAL: 3 warnings reached - showing popup to student');
  }, []);

  // Proctoring state
  const { status: proctoringStatus, alertCount } = useProctoring({
    studentId: user?.uid || '',
    examId,
    enabled: true,
    onWarningThresholdReached: handleWarningThresholdReached,
  });

  // Notifications state (initialized but currently unused)
  useNotifications({
    studentId: user?.uid || '',
    examId,
    enabled: true,
  });

  // Track proctoring status changes
  const previousStatusRef = useRef<ProctoringStatusType>('GREEN');

  // Track RED alert duration
  const redAlertStartTimeRef = useRef<number | null>(null);
  const warningShownRef = useRef(false);

  // Session ID (generate if not provided) - memoized to prevent infinite loops
  const sessionId = useMemo(() => providedSessionId || `session_${Date.now()}`, [providedSessionId]);

  // Auto-save timer
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Load exam questions on mount and register session
   */
  useEffect(() => {
    const loadExam = async () => {
      try {
        setIsLoading(true);

        // Fetch 10 random questions from Firebase
        const fetchedQuestions = await fetchRandomExamQuestions(examId, 10);

        if (fetchedQuestions.length === 0) {
          console.warn('⚠️ No questions found for exam:', examId);
          // Set empty questions array and continue - allow user to submit empty exam
          setQuestions([]);
          setIsLoading(false);
          return;
        }

        setQuestions(fetchedQuestions);

        // Try to load saved progress
        const savedProgress = loadProgressFromLocalStorage(examId);
        if (savedProgress) {
          console.log('✓ Restored previous progress from local storage');
          setAnswers(savedProgress.answers);
          setCurrentQuestionIndex(savedProgress.currentQuestionIndex);
          // Don't restore timeSpent - start fresh
        }

        // Initialize all questions in answers map
        const initialAnswers: StudentAnswers = {};
        fetchedQuestions.forEach((q) => {
          initialAnswers[q.id] = '';
        });
        setAnswers((prev) => ({ ...initialAnswers, ...prev }));

        // Register this student's session for live feed
        if (user) {
          await registerStudentSession(
            sessionId,
            user.uid,
            user.displayName || 'Student',
            user.email || 'unknown@example.com',
            examId,
            'Exam' // Could fetch actual exam title from database
          );
          console.log('✅ Session registered for live feed');
        }
      } catch (error) {
        console.error('Error loading exam:', error);
        alert('Failed to load exam. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadExam();
  }, [examId, user, sessionId]);

  /**
   * Listen for lock status and messages from teacher
   */
  useEffect(() => {
    if (!sessionId) return;

    // Subscribe to session lock status
    const sessionRef = doc(db, 'live_sessions', sessionId);
    const unsubscribeSession = onSnapshot(sessionRef, (snap) => {
      const data = snap.data();
      setIsScreenLocked(data?.isLocked ?? false);
    });

    // Subscribe to messages
    const messagesRef = collection(db, 'live_sessions', sessionId, 'messages');
    const unsubscribeMessages = onSnapshot(messagesRef, (snap) => {
      const newMessages = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(newMessages);
    });

    return () => {
      unsubscribeSession();
      unsubscribeMessages();
    };
  }, [sessionId]);

  /**
   * Submit exam - defined before effects to avoid dependency issues
   */
  const handleSubmitExam = useCallback(async () => {
    if (isSubmitted || !user) return;

    try {
      setIsSubmitting(true);

      // Calculate final result with AI feedback and proctoring status
      const finalResult = await calculateFinalResult(
        user.uid,
        examId,
        sessionId,
        answers,
        questions,
        30 * 60 - timeLeft, // Time taken in seconds
        alertCount
      );

      setSubmissionResult(finalResult);
      setIsSubmitted(true);
      clearProgressFromLocalStorage(examId);
      
      // End student session so it no longer appears in teacher monitoring
      try {
        await endStudentSession(sessionId);
        console.log('✅ Student session ended - removed from monitoring');
      } catch (error) {
        console.error('Error ending session:', error);
      }
      
      console.log('✅ Exam submitted successfully:', finalResult);

      // Navigate to results page after a short delay
      setTimeout(() => {
        navigate(`/results/${finalResult.resultId}`);
      }, 1500);
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Failed to submit exam. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [questions, answers, user, examId, sessionId, timeLeft, alertCount, navigate]);

  /**
   * Countdown timer effect
   */
  useEffect(() => {
    if (isSubmitted) return; // Don't start timer if already submitted

    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;

        // Auto-submit when timer reaches 0
        if (newTime <= 0) {
          clearInterval(timerInterval);
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [isSubmitted, handleSubmitExam]);

  /**
   * Auto-submit when time reaches 0
   */
  useEffect(() => {
    if (timeLeft <= 0 && !isSubmitted && questions.length > 0) {
      handleSubmitExam();
    }
  }, [timeLeft, isSubmitted, questions.length, handleSubmitExam]);

  /**
   * Auto-save progress every 30 seconds
   */
  useEffect(() => {
    if (questions.length === 0 || isSubmitted) return;

    autoSaveIntervalRef.current = setInterval(() => {
      saveProgressToLocalStorage(examId, answers, currentQuestionIndex, 0);
      console.log('💾 Auto-saved progress');
    }, 30000); // Every 30 seconds

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [examId, answers, currentQuestionIndex, isSubmitted, questions.length]);

  /**
   * Monitor proctoring status for RED alerts lasting > 10 seconds
   */
  useEffect(() => {
    if ((proctoringStatus as ProctoringStatus).status === 'RED') {
      // RED alert just triggered
      if (!redAlertStartTimeRef.current) {
        redAlertStartTimeRef.current = Date.now();
      }

      const alertDuration = Date.now() - redAlertStartTimeRef.current;

      // Show warning after 10 seconds of RED alert
      if (alertDuration > 10000 && !warningShownRef.current) {
        setShowSuspiciousWarning(true);
        warningShownRef.current = true;
        console.warn('⚠️ Suspicious activity warning shown');
      }
    } else {
      // Reset when status is not RED
      redAlertStartTimeRef.current = null;
      warningShownRef.current = false;
      setShowSuspiciousWarning(false);
    }
  }, [(proctoringStatus as ProctoringStatus).status]);

  /**
   * Update session status in Firebase for live feed
   */
  useEffect(() => {
    if (!user || !sessionId) return;

    const updateStatus = async () => {
      try {
        const status = ((proctoringStatus as ProctoringStatus).status || 'GREEN') as ProctoringStatusType;
        
        // Update session status in Firebase
        await updateSessionStatus(
          sessionId,
          user.uid,
          status,
          alertCount,
          previousStatusRef.current
        );

        previousStatusRef.current = status;
      } catch (error) {
        console.error('Error updating session status:', error);
      }
    };

    const interval = setInterval(updateStatus, 2000); // Update every 2 seconds
    updateStatus(); // Initial update

    return () => clearInterval(interval);
  }, [user, sessionId, (proctoringStatus as ProctoringStatus).status, alertCount]);

  /**
   * Handle answer selection
   */
  const handleSelectAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  /**
   * Navigate to previous question
   */
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  /**
   * Navigate to next question
   */
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  /**
   * Jump to specific question
   */
  const handleJumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  /**
   * Format time for display (MM:SS)
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  /**
   * Get time color based on remaining time
   */
  const getTimeColor = (): string => {
    if (timeLeft <= 300) return 'text-red-600'; // < 5 minutes
    if (timeLeft <= 600) return 'text-orange-600'; // < 10 minutes
    return 'text-green-600'; // > 10 minutes
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (isSubmitted && submissionResult) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">
            {submissionResult.percentage >= 80 ? '🎉' : submissionResult.percentage >= 60 ? '✓' : '📋'}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Exam Submitted!</h2>

          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-600 mb-2">Your Score</p>
            <p className="text-4xl font-bold text-blue-600">
              {submissionResult.percentage.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {submissionResult.score} / {submissionResult.totalPoints} points
            </p>
          </div>

          <div className="space-y-2 text-sm text-gray-600 mb-6">
            <p>
              <span className="font-semibold">Time Taken:</span> {formatTime(30 * 60 - timeLeft)}
            </p>
            <p>
              <span className="font-semibold">Alerts:</span> {alertCount}
            </p>
          </div>

          <button
            onClick={() => {
              // Navigate to results or home
              window.location.href = '/dashboard';
            }}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-semibold"
          >
            View Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.values(answers).filter((ans) => ans !== '').length;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Screen Lock Overlay */}
      <ScreenLockOverlay
        isLocked={isScreenLocked}
        lockReason="Exam locked due to excessive suspicious activity"
        studentName="Your Teacher"
      />

      {/* Suspicious Activity Warning Popup */}
      <SuspiciousActivityPopup
        isVisible={showWarningPopup && !isScreenLocked}
        warningCount={warningCount}
        onClose={() => setShowWarningPopup(false)}
        onContinue={() => setShowWarningPopup(false)}
        onSubmitExam={handleSubmitExam}
      />

      {/* Top Bar - Timer */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Exam in Progress</h1>
          <p className="text-sm text-gray-600">Question {currentQuestionIndex + 1} of {questions.length}</p>
        </div>

        {/* Timer */}
        <div className={`text-center ${getTimeColor()}`}>
          <p className="text-sm font-semibold text-gray-600 mb-1">Time Remaining</p>
          <p className="text-4xl font-bold font-mono">{formatTime(timeLeft)}</p>
          {timeLeft <= 300 && <p className="text-xs font-semibold mt-1">⏰ Time running out!</p>}
        </div>

        {/* Alert & Warning Counter */}
        <div className="ml-6 space-y-2">
          {/* Warning Count Display */}
          <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg border-2 border-orange-600">
            <p className="text-xs font-semibold">⚠️ Warnings: {warningCount}/3</p>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold ${
                    warningCount >= i
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {i}
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Counter */}
          {alertCount > 0 ? (
            <div className="bg-red-100 text-red-800 px-3 py-2 rounded-lg">
              <p className="text-xs font-semibold">🚨 {alertCount} Alert{alertCount !== 1 ? 's' : ''}</p>
            </div>
          ) : (
            <div className="bg-green-100 text-green-800 px-3 py-2 rounded-lg">
              <p className="text-xs font-semibold">✓ Clean</p>
            </div>
          )}
        </div>
      </div>

      {/* Suspicious Activity Warning */}
      {showSuspiciousWarning && (
        <div className="bg-red-50 border-l-4 border-red-600 px-6 py-3 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-red-900">Warning: Suspicious Activity Detected!</p>
              <p className="text-sm text-red-800">Your behavior has been flagged for review. {(proctoringStatus as ProctoringStatus).reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Messages */}
      {messages.length > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-600 px-6 py-3 max-h-24 overflow-y-auto">
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className={`p-2 rounded ${msg.type === 'warning' ? 'bg-orange-100 border-l-2 border-orange-600' : 'bg-blue-100 border-l-2 border-blue-600'}`}>
                <p className="text-xs font-bold text-gray-900">
                  {msg.type === 'warning' ? '⚠️ Warning from Teacher' : '💬 Message from Teacher'}
                </p>
                <p className="text-sm text-gray-800 mt-1">{msg.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex overflow-hidden ${isScreenLocked ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Left Sidebar - Question Navigator */}
        <div className="w-32 bg-white border-r border-gray-200 overflow-y-auto p-3 space-y-2">
          <p className="text-xs font-bold text-gray-700 px-2 uppercase">Questions</p>
          <div className="text-xs text-gray-600 px-2 mb-3">
            Answered: {answeredCount}/{questions.length}
          </div>

          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => handleJumpToQuestion(idx)}
              className={`w-full py-2 px-2 rounded text-xs font-semibold transition ${
                currentQuestionIndex === idx
                  ? 'bg-blue-600 text-white'
                  : answers[q.id]
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Q{idx + 1}
              {answers[q.id] && <span className="ml-1">✓</span>}
            </button>
          ))}
        </div>

        {/* Center - Question Display */}
        <div className="flex-1 overflow-auto p-6">
          {currentQuestion && (
            <div className="max-w-2xl mx-auto">
              {/* Question Header */}
              <div className="mb-6">
                <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold mb-2">
                  Question {currentQuestionIndex + 1}/{questions.length}
                </span>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentQuestion.text}</h2>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">{currentQuestion.points} points</span>
                </p>
              </div>

              {/* Answer Options */}
              <div className="space-y-3 mb-8">
                {currentQuestion.options.map((option, idx) => {
                  const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D
                  const isSelected = answers[currentQuestion.id] === option.id;

                  return (
                    <label
                      key={option.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question_${currentQuestion.id}`}
                        value={option.id}
                        checked={isSelected}
                        onChange={() => handleSelectAnswer(currentQuestion.id, option.id)}
                        className="mt-1 h-5 w-5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {optionLetter}. {option.text}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3 justify-between">
                <button
                  onClick={handlePrevQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  ← Previous
                </button>

                <button
                  onClick={handleNextQuestion}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Proctoring Monitor */}
        <div className="w-96 border-l border-gray-200 bg-gray-50 overflow-auto">
          <div className="sticky top-0 p-4 bg-white border-b">
            <h3 className="font-bold text-gray-900">Live Proctoring</h3>
            <p className="text-xs text-gray-600">Real-time monitoring active</p>
          </div>

          <div className="p-4">
            <ProctoringMonitor
              studentId={user!.uid}
              examId={examId}
              enabled={!isSubmitted}
              onAlertTriggered={(alert) => {
                console.log('🚨 Proctoring Alert:', alert);
              }}
              onWarningThresholdReached={handleWarningThresholdReached}
            />
          </div>
        </div>
      </div>

      {/* Bottom Bar - Submit Button */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3 shadow-sm">
        <button
          onClick={() => {
            if (!window.confirm('Are you sure you want to exit without submitting?')) {
              return;
            }
            window.location.href = '/dashboard';
          }}
          disabled={isScreenLocked}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Exit
        </button>

        <button
          onClick={handleSubmitExam}
          disabled={isSubmitting || isScreenLocked}
          className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Submitting...
            </>
          ) : isScreenLocked ? (
            <>🔒 Exam Locked</>
          ) : (
            <>✓ Submit Exam</>
          )}
        </button>

        {isScreenLocked && (
          <div className="ml-4 p-2 bg-red-50 border border-red-600 rounded-lg">
            <p className="text-xs font-bold text-red-800">🔒 Your exam is locked by your teacher</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamRoom;
