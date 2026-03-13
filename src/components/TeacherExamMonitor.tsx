import React, { useEffect, useState } from 'react';
import { subscribeToActiveSessions } from '../services/chatService';
import { db } from '../config/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import StudentControlPanel from './StudentControlPanel';
import type { StudentSession } from '../types/chat';

interface TeacherExamMonitorProps {
  examId: string;
  onNewAlert?: (alert: any) => void;
}

/**
 * TeacherExamMonitor Component
 * 
 * Comprehensive real-time monitoring dashboard for teachers
 * Shows all students taking the exam with:
 * - Individual proctoring status (GREEN/YELLOW/RED)
 * - Warning count (0-3+)
 * - Time remaining
 * - Alert history
 * - Suspicious activity notifications
 */
export const TeacherExamMonitor: React.FC<TeacherExamMonitorProps> = ({ examId, onNewAlert }) => {
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alertHistory, setAlertHistory] = useState<any[]>([]);
  const [criticalStudents, setCriticalStudents] = useState<Set<string>>(new Set());
  const [lockedStudents, setLockedStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsLoading(true);

    const unsubscribe = subscribeToActiveSessions(
      examId,
      (updatedSessions) => {
        setSessions(updatedSessions);
        setIsLoading(false);

        // Track critical students (RED status or 3+ warnings)
        const critical = new Set<string>();
        updatedSessions.forEach((session) => {
          if (session.proctoringStatus === 'RED' || (session.alertCount ?? 0) >= 3) {
            critical.add(session.studentId);
            
            // Add to alert history
            if (!alertHistory.some(a => a.studentId === session.studentId && a.timestamp > Date.now() - 5000)) {
              const newAlert = {
                studentId: session.studentId,
                studentName: session.studentName,
                status: session.proctoringStatus,
                alertCount: session.alertCount,
                timestamp: Date.now(),
              };
              setAlertHistory(prev => [newAlert, ...prev].slice(0, 50));
              onNewAlert?.(newAlert);
            }
          }
        });
        setCriticalStudents(critical);
      },
      (error) => {
        console.error('Error in teacher monitor:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe?.();
  }, [examId, onNewAlert]);

  /**
   * Lock or unlock student's exam
   */
  const handleLockUnlock = async (studentId: string, shouldLock: boolean) => {
    try {
      // Find the session for this student
      const session = sessions.find(s => s.studentId === studentId);
      if (!session) return;

      // Update the live_session document
      const sessionRef = doc(db, 'live_sessions', session.sessionId);
      await updateDoc(sessionRef, {
        isLocked: shouldLock,
        lockedAt: serverTimestamp(),
      });

      // Update local state
      if (shouldLock) {
        setLockedStudents(prev => new Set([...prev, studentId]));
      } else {
        setLockedStudents(prev => {
          const updated = new Set(prev);
          updated.delete(studentId);
          return updated;
        });
      }

      console.log(`${shouldLock ? 'Locked' : 'Unlocked'} student: ${studentId}`);
    } catch (error) {
      console.error('Error locking/unlocking student:', error);
    }
  };

  /**
   * Send warning or message to student
   */
  const handleSendMessage = async (studentId: string, message: string, type: 'warning' | 'message') => {
    try {
      // Find the session for this student
      const session = sessions.find(s => s.studentId === studentId);
      if (!session) return;

      // Add message to messages subcollection
      const messagesRef = collection(db, 'live_sessions', session.sessionId, 'messages');
      await addDoc(messagesRef, {
        type,
        message,
        sentAt: serverTimestamp(),
        read: false,
        sender: 'teacher',
      });

      console.log(`Sent ${type} to student: ${studentId}`);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  /**
   * Get status color and styling
   */
  const getStatusColor = (status: string, alertCount: number): string => {
    if (alertCount >= 3) return 'bg-red-500 text-white';
    switch (status) {
      case 'GREEN':
        return 'bg-green-100 text-green-800';
      case 'YELLOW':
        return 'bg-yellow-100 text-yellow-800';
      case 'RED':
        return 'bg-red-100 text-red-800 animate-pulse';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (status: string, alertCount: number): string => {
    if (alertCount >= 3) return '🚨';
    switch (status) {
      case 'GREEN':
        return '✓';
      case 'YELLOW':
        return '⚠';
      case 'RED':
        return '⚠';
      default:
        return '?';
    }
  };

  /**
   * Format time
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  /**
   * Sort students: critical first, then by alert count
   * Only show active sessions (filter out completed exams)
   */
  const sortedSessions = [...sessions]
    .filter(session => session.isActive !== false) // Exclude completed exams
    .sort((a, b) => {
      const aIsCritical = criticalStudents.has(a.studentId);
      const bIsCritical = criticalStudents.has(b.studentId);
      if (aIsCritical !== bIsCritical) return aIsCritical ? -1 : 1;
      return (b.alertCount ?? 0) - (a.alertCount ?? 0);
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading exam monitoring...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 font-semibold">Active Students</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{sortedSessions.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-sm text-green-800 font-semibold">✓ Safe</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {sortedSessions.filter(s => s.proctoringStatus === 'GREEN' && (s.alertCount ?? 0) < 3).length}
          </p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-sm text-yellow-800 font-semibold">⚠ Warning</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">
            {sortedSessions.filter(s => s.proctoringStatus === 'YELLOW').length}
          </p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-sm text-red-800 font-semibold">🚨 Critical</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{criticalStudents.size}</p>
        </div>
      </div>

      {/* Student Cards Grid */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Student Monitoring</h3>
        
        {sortedSessions.length === 0 ? (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-lg font-semibold text-blue-900 mb-2">All Students Completed</p>
            <p className="text-blue-700">All students in this exam have submitted their answers and are no longer being monitored.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedSessions.map((session) => (
            <div
              key={session.sessionId}
              className={`p-4 rounded-lg border-2 transition ${
                criticalStudents.has(session.studentId)
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Student Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{session.studentName}</p>
                  <p className="text-xs text-gray-600">{session.studentEmail || 'No email'}</p>
                </div>
                <div className={`${getStatusColor(session.proctoringStatus, session.alertCount ?? 0)} px-3 py-1 rounded-full font-bold text-sm`}>
                  {getStatusIcon(session.proctoringStatus, session.alertCount ?? 0)}
                </div>
              </div>

              {/* Metrics */}
              <div className="space-y-2 mb-4">
                {/* Warning Count */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Warnings:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          (session.alertCount ?? 0) >= i
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-300 text-gray-600'
                        }`}
                      >
                        {i}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Status:</span>
                  <span className="text-xs">
                    {session.proctoringStatus === 'GREEN' && '✓ Normal'}
                    {session.proctoringStatus === 'YELLOW' && '⚠ Caution'}
                    {session.proctoringStatus === 'RED' && '⚠ Suspicious'}
                  </span>
                </div>

                {/* Time Remaining */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Time Left:</span>
                  <span className="text-xs font-mono">{formatTime(session.timeRemaining ?? 0)}</span>
                </div>
              </div>

              {/* Alert Details */}
              {(session.alertCount ?? 0) > 0 && (
                <div className="bg-red-100 p-2 rounded text-xs border-l-2 border-red-600">
                  <p className="font-semibold text-red-900 mb-1">
                    {session.alertCount} Alert{(session.alertCount ?? 0) !== 1 ? 's' : ''}
                  </p>
                  <p className="text-red-800">Looking away or suspicious activity detected</p>
                </div>
              )}

              {/* Critical Badge */}
              {(session.alertCount ?? 0) >= 3 && (
                <div className="mt-3 bg-red-600 text-white p-2 rounded text-xs font-bold text-center">
                  🚨 CRITICAL - 3 Warnings Reached
                </div>
              )}

              {/* Teacher Control Panel */}
              <div className="mt-4 pt-4 border-t border-gray-300">
                <StudentControlPanel
                  studentId={session.studentId}
                  studentName={session.studentName}
                  warningCount={session.alertCount ?? 0}
                  isLocked={lockedStudents.has(session.studentId)}
                  onLock={handleLockUnlock}
                  onSendWarning={(studentId, message) => handleSendMessage(studentId, message, 'warning')}
                  onSendMessage={(studentId, message) => handleSendMessage(studentId, message, 'message')}
                />
              </div>
            </div>
          ))}
            </div>
          )}
      </div>

      {/* Recent Alert History */}
      {alertHistory.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow border border-red-200">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-red-600">🚨</span> Recent Alerts
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {alertHistory.slice(0, 10).map((alert, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm p-2 bg-red-50 rounded border-l-2 border-red-600">
                <div>
                  <p className="font-semibold text-red-900">{alert.studentName}</p>
                  <p className="text-xs text-red-700">
                    {alert.status === 'RED' ? 'Suspicious Activity' : 'Status Changed'}
                  </p>
                </div>
                <span className="text-xs font-mono text-gray-600">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherExamMonitor;
