import React, { useEffect, useState } from 'react';
import { useProctoring } from '../hooks/useProctoring';
import type { ProctoringStatus } from '../types/proctoring';

interface ProctoringMonitorProps {
  studentId: string;
  examId: string;
  enabled?: boolean;
  onAlertTriggered?: (alert: string) => void;
  onWarningThresholdReached?: (count: number) => void;
}

/**
 * ProctoringMonitor Component
 * 
 * Displays webcam feed with real-time proctoring status
 * Monitors for suspicious behavior including:
 * - Looking away: Head turned left/right (yaw > 75 degrees)
 * - Multiple people in frame
 * 
 * Triggers alerts and increments warning count
 * Notifies teacher when 3 warnings are reached
 */
export const ProctoringMonitor: React.FC<ProctoringMonitorProps> = ({
  studentId,
  examId,
  enabled = true,
  onAlertTriggered,
  onWarningThresholdReached,
}) => {
  const { videoRef, status, isInitialized, alertCount } = useProctoring({
    studentId,
    examId,
    enabled,
    lookingAwayThreshold: 60,
    mouthMovementThreshold: 0.08,
    alertThreshold: 5000,
    onWarningThresholdReached,
  });

  const [detailsVisible, setDetailsVisible] = useState(false);

  useEffect(() => {
    const procStatus = status as ProctoringStatus;
    if (procStatus.status === 'RED' && procStatus.reason && onAlertTriggered) {
      onAlertTriggered(procStatus.reason);
    }
  }, [status, onAlertTriggered]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'GREEN':
        return 'border-green-500 bg-green-50';
      case 'RED':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-400 bg-gray-50';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'GREEN':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'RED':
        return 'bg-red-100 text-red-800 border-red-300 animate-pulse';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      {/* Video Feed Container */}
      <div className={`relative rounded-lg border-4 overflow-hidden ${getStatusColor((status as ProctoringStatus).status)}`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full aspect-video bg-black object-cover"
          style={{ transform: 'scaleX(-1)' }} // Mirror effect
        />

        {/* Status Overlay */}
        <div className="absolute top-4 right-4 flex gap-2 items-center">
          {!isInitialized && (
            <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
              Initializing...
            </div>
          )}
          {isInitialized && (
            <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusBadgeColor((status as ProctoringStatus).status)}`}>
              {(status as ProctoringStatus).status === 'GREEN' && '✓ Safe'}
              {(status as ProctoringStatus).status === 'RED' && '⚠ Alert'}
              {(status as ProctoringStatus).status === 'YELLOW' && '⚠ Caution'}
            </div>
          )}
        </div>

        {/* Alert Count Badge */}
        {alertCount > 0 && (
          <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            🚨 {alertCount} Alert{alertCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Status Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Proctoring Status</h3>
          <button
            onClick={() => setDetailsVisible(!detailsVisible)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {detailsVisible ? 'Hide' : 'Show'} Details
          </button>
        </div>

        {/* Live Status */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-3 h-3 rounded-full ${(status as ProctoringStatus).status === 'GREEN' ? 'bg-green-500' : (status as ProctoringStatus).status === 'RED' ? 'bg-red-500' : 'bg-yellow-500'}`}
            />
            <span className="font-semibold text-gray-900">
              {(status as ProctoringStatus).status === 'GREEN' && 'Normal Behavior'}
              {(status as ProctoringStatus).status === 'RED' && 'Suspicious Activity Detected'}
              {(status as ProctoringStatus).status === 'YELLOW' && 'Caution: Monitor Behavior'}
            </span>
          </div>
          {(status as ProctoringStatus).reason && (
            <p className="text-sm text-gray-600 ml-5 bg-yellow-50 p-2 rounded border-l-2 border-yellow-400">
              {(status as ProctoringStatus).reason}
            </p>
          )}
        </div>

        {/* Detailed Metrics (Expandable) */}
        {detailsVisible && (
          <div className="border-t pt-3 mt-3 space-y-2 bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">
              <div className="flex justify-between mb-2">
                <span>Mouth Movement:</span>
                <span className={(status as ProctoringStatus).metrics?.mouthMoving ? 'text-red-600 font-semibold' : 'text-green-600'}>
                  {(status as ProctoringStatus).metrics?.mouthMoving ? '⚠ Detected' : '✓ Normal'}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Looking Away:</span>
                <span className={(status as ProctoringStatus).metrics?.lookingAway ? 'text-red-600 font-semibold' : 'text-green-600'}>
                  {(status as ProctoringStatus).metrics?.lookingAway ? '⚠ Detected' : '✓ Normal'}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Head Rotation (Yaw):</span>
                <span className={(status as ProctoringStatus).metrics?.headPoseAngle ?? 0 > 25 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                  {((status as ProctoringStatus).metrics?.headPoseAngle ?? 0).toFixed(1)}°
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Mouth Distance:</span>
                <span className="text-gray-700">{((status as ProctoringStatus).metrics?.mouthDistance ?? 0).toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span>Multiple Faces:</span>
                <span className={(status as ProctoringStatus).metrics?.multipleFaces ? 'text-red-600 font-semibold' : 'text-green-600'}>
                  {(status as ProctoringStatus).metrics?.multipleFaces ? '⚠ Detected' : '✓ Normal'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Counter */}
        {alertCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-800 font-semibold">
              🚨 {alertCount} suspicious behavior{alertCount !== 1 ? 's' : ''} detected and logged.
            </p>
            <p className="text-xs text-red-700 mt-1">
              All incidents are being tracked and recorded for exam review.
            </p>
          </div>
        )}
      </div>

      {/* Permissions Notice */}
      {!isInitialized && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">📹 Camera Permission Required</span>
            <br />
            Please allow camera access to proceed with the proctored exam.
          </p>
        </div>
      )}

      {/* Testing Info */}
      {typeof window !== 'undefined' && typeof document !== 'undefined' && (() => {
        try {
          return (globalThis as any).process?.env?.NODE_ENV === 'development';
        } catch {
          return false;
        }
      })() && (
        <div className="bg-purple-50 border border-purple-200 rounded p-4 text-xs text-purple-800">
          <p className="font-semibold mb-2">🔧 Development Info</p>
          <p>Student ID: {studentId}</p>
          <p>Exam ID: {examId}</p>
          <p>Face Landmarker: {isInitialized ? '✓ Loaded' : '⏳ Loading'}</p>
          <p>Proctoring: {enabled ? '✓ Active' : '✗ Disabled'}</p>
        </div>
      )}
    </div>
  );
};

export default ProctoringMonitor;
