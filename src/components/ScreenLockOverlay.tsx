import React from 'react';

interface ScreenLockOverlayProps {
  isLocked: boolean;
  lockReason?: string;
  studentName?: string;
}

/**
 * ScreenLockOverlay Component
 * 
 * Displays a full-screen lock overlay when:
 * - 3+ warnings reached
 * - Teacher manually locks student's screen
 * 
 * Student cannot interact with exam while locked
 */
export const ScreenLockOverlay: React.FC<ScreenLockOverlayProps> = ({
  isLocked,
  lockReason = 'Screen locked by teacher',
  studentName,
}) => {
  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 backdrop-blur">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 text-center border-4 border-red-600">
        {/* Lock Icon */}
        <div className="mb-4">
          <div className="text-7xl mb-4">🔒</div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-red-600 mb-4">EXAM LOCKED</h2>

        {/* Details */}
        <div className="bg-red-50 p-4 rounded-lg mb-6 border-l-4 border-red-600">
          <p className="text-red-900 font-semibold mb-2">Your exam has been locked</p>
          <p className="text-sm text-red-800 mb-3">{lockReason}</p>
          {studentName && (
            <p className="text-sm text-red-700">
              <span className="font-semibold">Teacher:</span> {studentName}
            </p>
          )}
        </div>

        {/* Warning Information */}
        <div className="bg-yellow-50 p-4 rounded-lg mb-6 border-l-4 border-yellow-600">
          <p className="text-sm text-yellow-900">
            <span className="font-semibold">Why is this locked?</span>
            <br />
            You have reached the maximum number of warnings for suspicious activity. Your teacher has locked your exam.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">What to do?</span>
            <br />
            Wait for your teacher to unlock your exam, or contact your teacher for assistance.
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-600 mt-6">
          Your exam progress has been saved. This screen will unlock once your teacher approves it.
        </p>
      </div>
    </div>
  );
};

export default ScreenLockOverlay;
