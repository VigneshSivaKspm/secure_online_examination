import React, { useEffect, useState, useRef } from 'react';
import { subscribeToActiveSessions } from '../services/chatService';
import type { StudentSession } from '../types/chat';

interface LiveFeedProps {
  examId: string;
  onRedStatusDetected?: (student: StudentSession) => void;
}

/**
 * LiveFeed Component
 * Shows real-time list of active students taking the exam
 * Displays proctoring status, alerts, and time remaining
 */
export const LiveFeed: React.FC<LiveFeedProps> = ({ examId, onRedStatusDetected }) => {
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const redAlertStorageRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create notification audio on mount
  useEffect(() => {
    // Use a Web Audio API beep as fallback if no audio file available
    audioRef.current = new Audio();
    // You can replace this with actual audio file URL if available
    // audioRef.current.src = '/sounds/notification.mp3';
  }, []);

  useEffect(() => {
    setIsLoading(true);
    
    const unsubscribe = subscribeToActiveSessions(
      examId,
      (updatedSessions) => {
        setSessions(updatedSessions);
        setIsLoading(false);

        // Check for new RED status changes
        updatedSessions.forEach((session) => {
          if (session.proctoringStatus === 'RED' && !redAlertStorageRef.current.has(session.sessionId)) {
            redAlertStorageRef.current.add(session.sessionId);
            
            // Play notification sound
            playNotificationSound();
            
            // Show alert
            onRedStatusDetected?.(session);
          }
        });
      },
      (error) => {
        console.error('Error in live feed:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe?.();
  }, [examId, onRedStatusDetected]);

  /**
   * Play notification sound for RED status
   */
  const playNotificationSound = () => {
    try {
      // Try to play audio file if available
      if (audioRef.current?.src) {
        audioRef.current
          .play()
          .catch(() => playFallbackSound());
      } else {
        playFallbackSound();
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  /**
   * Fallback: Generate beep sound using Web Audio API
   */
  const playFallbackSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 1000; // 1kHz tone
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing fallback sound:', error);
    }
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'GREEN':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'YELLOW':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'RED':
        return 'bg-red-100 text-red-800 border-red-300 animate-pulse';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  /**
   * Get connection status icon
   */
  const getConnectionIcon = (status: string): string => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'idle':
        return '🟡';
      case 'offline':
        return '🔴';
      default:
        return '⚪';
    }
  };

  /**
   * Format time remaining
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading active students...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No active students yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            🎓 Live Student Feed
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {sessions.length} student{sessions.length !== 1 ? 's' : ''} currently taking exam
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            LIVE
          </span>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">
                Student
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">
                Status
              </th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-700 uppercase">
                Alerts
              </th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-700 uppercase">
                Progress
              </th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-700 uppercase">
                Time Left
              </th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-700 uppercase">
                Connection
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sessions.map((session) => (
              <tr
                key={session.sessionId}
                className={`
                  hover:bg-gray-50 transition
                  ${session.proctoringStatus === 'RED' ? 'bg-red-50' : ''}
                `}
              >
                {/* Student Name */}
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">
                      {session.studentName}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {session.studentEmail}
                    </span>
                  </div>
                </td>

                {/* Proctoring Status */}
                <td className="px-6 py-4">
                  <span
                    className={`
                      inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
                      border ${getStatusColor(session.proctoringStatus)}
                    `}
                  >
                    {session.proctoringStatus === 'RED' && '🚨'}
                    {session.proctoringStatus === 'YELLOW' && '⚠️'}
                    {session.proctoringStatus === 'GREEN' && '✓'}
                    {' '}
                    {session.proctoringStatus}
                  </span>
                </td>

                {/* Alert Count */}
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {session.alertCount > 0 && (
                      <>
                        <span
                          className={`
                            px-2 py-1 rounded text-xs font-bold
                            ${session.alertCount > 5 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-yellow-100 text-yellow-700'}
                          `}
                        >
                          {session.alertCount}
                        </span>
                      </>
                    )}
                    {session.alertCount === 0 && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </td>

                {/* Progress */}
                <td className="px-6 py-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-semibold text-gray-900">
                      {session.answeredCount}/10
                    </span>
                    <div className="w-24 h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${(session.answeredCount / 10) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>

                {/* Time Remaining */}
                <td className="px-6 py-4 text-center">
                  <span
                    className={`
                      font-mono text-sm font-bold
                      ${session.timeRemaining < 300
                        ? 'text-red-600'
                        : session.timeRemaining < 600
                          ? 'text-orange-600'
                          : 'text-green-600'}
                    `}
                  >
                    {formatTime(session.timeRemaining)}
                  </span>
                </td>

                {/* Connection Status */}
                <td className="px-6 py-4 text-center">
                  <span className="text-lg">
                    {getConnectionIcon(session.connectionStatus)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 grid grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-xs text-gray-600 uppercase font-semibold mb-1">
            Active
          </p>
          <p className="text-lg font-bold text-gray-900">
            {sessions.filter((s) => s.connectionStatus === 'online').length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 uppercase font-semibold mb-1">
            Red Alerts
          </p>
          <p className="text-lg font-bold text-red-600">
            {sessions.filter((s) => s.proctoringStatus === 'RED').length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 uppercase font-semibold mb-1">
            Yellow Alerts
          </p>
          <p className="text-lg font-bold text-yellow-600">
            {sessions.filter((s) => s.proctoringStatus === 'YELLOW').length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 uppercase font-semibold mb-1">
            All Clear
          </p>
          <p className="text-lg font-bold text-green-600">
            {sessions.filter((s) => s.proctoringStatus === 'GREEN').length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LiveFeed;
