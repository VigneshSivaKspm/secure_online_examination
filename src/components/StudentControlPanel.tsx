import React, { useState } from 'react';

interface StudentControlPanelProps {
  studentId: string;
  studentName: string;
  warningCount: number;
  isLocked: boolean;
  onLock: (studentId: string, lock: boolean) => void;
  onSendWarning: (studentId: string, message: string) => void;
  onSendMessage: (studentId: string, message: string) => void;
}

/**
 * StudentControlPanel Component
 * 
 * Teacher controls for individual students:
 * - Lock/unlock exam
 * - Send warnings
 * - Send messages
 * - View warning count
 */
export const StudentControlPanel: React.FC<StudentControlPanelProps> = ({
  studentId,
  studentName,
  warningCount,
  isLocked,
  onLock,
  onSendWarning,
  onSendMessage,
}) => {
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'warning' | 'message'>('message');

  const handleSendMessage = () => {
    if (!messageText.trim()) return;

    if (messageType === 'warning') {
      onSendWarning(studentId, messageText);
    } else {
      onSendMessage(studentId, messageText);
    }

    setMessageText('');
    setMessageType('message');
    setShowMessagePanel(false);
  };

  return (
    <div className="space-y-2">
      {/* Warning Count Info */}
      <div className="bg-gray-50 p-2 rounded border border-gray-300 text-xs">
        <p className="font-semibold text-gray-700"><strong>{studentName}</strong> - Warnings: <span className="text-orange-600 font-bold">{warningCount}/3</span></p>
      </div>
      {/* Lock/Unlock Button */}
      <button
        onClick={() => onLock(studentId, !isLocked)}
        className={`w-full py-2 px-3 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-2 ${
          isLocked
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        {isLocked ? '🔓 Unlock Exam' : '🔒 Lock Exam'}
      </button>

      {/* Send Message Button */}
      <button
        onClick={() => setShowMessagePanel(!showMessagePanel)}
        className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 font-semibold text-sm flex items-center justify-center gap-2 transition"
      >
        💬 Send Message
      </button>

      {/* Message/Warning Panel */}
      {showMessagePanel && (
        <div className="bg-gray-100 p-3 rounded-lg border border-gray-300 space-y-2">
          {/* Message Type Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setMessageType('message')}
              className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition ${
                messageType === 'message'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              📝 Message
            </button>
            <button
              onClick={() => setMessageType('warning')}
              className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition ${
                messageType === 'warning'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              ⚠️ Warning
            </button>
          </div>

          {/* Message Input */}
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={
              messageType === 'warning'
                ? 'Send warning to student...'
                : 'Send message to student...'
            }
            className="w-full p-2 border border-gray-300 rounded text-xs font-mono resize-none focus:outline-none focus:border-blue-500"
            rows={3}
          />

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            className="w-full bg-green-600 text-white py-1 px-2 rounded text-xs font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ✓ Send {messageType === 'warning' ? 'Warning' : 'Message'}
          </button>

          {/* Cancel Button */}
          <button
            onClick={() => setShowMessagePanel(false)}
            className="w-full bg-gray-600 text-white py-1 px-2 rounded text-xs font-semibold hover:bg-gray-700 transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentControlPanel;
