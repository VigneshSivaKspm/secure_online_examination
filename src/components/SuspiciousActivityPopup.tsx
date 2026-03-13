import React from 'react';

interface SuspiciousActivityPopupProps {
  isVisible: boolean;
  warningCount: number;
  onClose?: () => void;
  onContinue: () => void;
  onSubmitExam: () => void;
}

/**
 * SuspiciousActivityPopup Component
 * 
 * Displays a warning dialog when 3 suspicious activities are detected
 * Allows student to continue or submit exam with warning
 */
export const SuspiciousActivityPopup: React.FC<SuspiciousActivityPopupProps> = ({
  isVisible,
  warningCount,
  onContinue,
  onSubmitExam,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 border-4 border-red-600">
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="text-6xl">⚠️</div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-red-600 text-center mb-3">
          SUSPICIOUS ACTIVITY DETECTED
        </h2>

        {/* Warning Details */}
        <div className="bg-red-50 p-4 rounded-lg mb-6 border-l-4 border-red-600">
          <p className="text-gray-800 font-semibold mb-2">⚠️ Warning Level: {warningCount}/3</p>
          <p className="text-gray-700 text-sm">
            Multiple suspicious behaviors have been detected during your exam. This may affect your final score and result.
          </p>
        </div>

        {/* Behavior List */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <p className="font-semibold text-gray-900 mb-2">Detected Behaviors:</p>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Looking away from screen</li>
            <li>• Excessive head movement</li>
            <li>• Suspicious activity patterns</li>
          </ul>
        </div>

        {/* Warning Message */}
        <div className="bg-yellow-50 p-3 rounded-lg mb-6 border-l-4 border-yellow-600">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">Note:</span> Your behavior is being recorded and reported to your teacher. Please maintain proper exam etiquette.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onContinue}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-semibold transition"
          >
            Continue Exam
          </button>
          <button
            onClick={onSubmitExam}
            className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 font-semibold transition"
          >
            Submit Now
          </button>
        </div>

        {/* Footer Info */}
        <p className="text-xs text-gray-600 text-center mt-4">
          Your teacher has been notified of this activity.
        </p>
      </div>
    </div>
  );
};

export default SuspiciousActivityPopup;
