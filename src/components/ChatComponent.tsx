import React, { useState, useEffect, useRef } from 'react';
import {
  sendTeacherMessage,
  sendBulkMessage,
  getMessageHistory,
} from '../services/chatService';
import type { StudentSession, ChatMessage } from '../types/chat';

interface ChatComponentProps {
  teacherId: string;
  examId: string;
  activeSessions: StudentSession[];
}

/**
 * ChatComponent
 * Allows teachers to send messages and notifications to students
 * Messages appear as toast notifications on student exam screens
 */
export const ChatComponent: React.FC<ChatComponentProps> = ({
  teacherId,
  examId,
  activeSessions,
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string>('all');
  const [messageType, setMessageType] = useState<'text' | 'alert'>('text');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Load message history
   */
  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory, examId]);

  /**
   * Scroll to bottom when history updates
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageHistory]);

  /**
   * Load message history from Firebase
   */
  const loadHistory = async () => {
    try {
      const history = await getMessageHistory(examId, 50);
      setMessageHistory(history);
    } catch (error) {
      console.error('Error loading message history:', error);
    }
  };

  /**
   * Get selected recipient IDs
   */
  const getRecipientIds = (): string[] => {
    if (selectedRecipients === 'all') {
      return activeSessions.map((s) => s.studentId);
    } else if (selectedRecipients === 'red') {
      return activeSessions
        .filter((s) => s.proctoringStatus === 'RED')
        .map((s) => s.studentId);
    } else {
      return [selectedRecipients];
    }
  };

  /**
   * Send message
   */
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    const recipientIds = getRecipientIds();
    if (recipientIds.length === 0) {
      alert('No recipients selected');
      return;
    }

    try {
      setIsSending(true);

      if (selectedRecipients === 'all') {
        // Send bulk message to all
        await sendBulkMessage(teacherId, examId, message, activeSessions);
      } else {
        // Send to specific student(s)
        await sendTeacherMessage(
          teacherId,
          examId,
          recipientIds,
          message,
          messageType === 'alert' ? 'high' : 'normal'
        );
      }

      // Clear input
      setMessage('');

      // Reload history
      await loadHistory();

      // Show success
      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Get recipient display name
   */
  const getRecipientName = (): string => {
    if (selectedRecipients === 'all') {
      return `All Students (${activeSessions.length})`;
    } else if (selectedRecipients === 'red') {
      const redCount = activeSessions.filter(
        (s) => s.proctoringStatus === 'RED'
      ).length;
      return `RED Status (${redCount})`;
    } else {
      const student = activeSessions.find((s) => s.studentId === selectedRecipients);
      return student?.studentName || 'Unknown Student';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-blue-50 border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-bold text-gray-900">
          💬 Send Message to Students
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Messages appear as notifications on student exam screens
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Recipient Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Send to:
            </label>
            <select
              value={selectedRecipients}
              onChange={(e) => setSelectedRecipients(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Active Students</option>
              <option value="red">
                Students with RED Status (
                {activeSessions.filter((s) => s.proctoringStatus === 'RED').length})
              </option>
              <optgroup label="Individual Students">
                {activeSessions.map((session) => (
                  <option key={session.studentId} value={session.studentId}>
                    {session.studentName} - {session.proctoringStatus}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Message Type:
            </label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value as 'text' | 'alert')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="text">Regular Message</option>
              <option value="alert">Alert / Important</option>
            </select>
          </div>
        </div>

        {/* Recipient Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <strong>📨 Recipient:</strong> {getRecipientName()}
        </div>

        {/* Message Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Message:
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here... (e.g., 'Please look at the screen', 'Time is running out', 'Review your answers')"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            maxLength={500}
          />
          <div className="text-xs text-gray-500 mt-1">
            {message.length}/500 characters
          </div>
        </div>

        {/* Quick Message Buttons */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">Quick Messages:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Please look at the screen',
              'Time is running out',
              'Review your answers',
              'Stop any suspicious activity',
              'Submit your exam now',
            ].map((quickMsg) => (
              <button
                key={quickMsg}
                onClick={() => setMessage(quickMsg)}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-xs font-medium transition"
              >
                {quickMsg}
              </button>
            ))}
          </div>
        </div>

        {/* Send Button */}
        <div className="flex gap-2">
          <button
            onClick={handleSendMessage}
            disabled={isSending || !message.trim()}
            className={`
              flex-1 px-6 py-2 rounded-lg font-semibold transition
              ${isSending || !message.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'}
            `}
          >
            {isSending ? '📤 Sending...' : '📤 Send Message'}
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-6 py-2 rounded-lg font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 transition"
          >
            {showHistory ? '👁️ Hide' : '👁️ History'}
          </button>
        </div>
      </div>

      {/* Message History */}
      {showHistory && (
        <div className="border-t border-gray-200 bg-gray-50 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Recent Messages</h4>

          {messageHistory.length === 0 ? (
            <p className="text-gray-600 text-sm">No messages yet</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {messageHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`
                    p-3 rounded-lg text-sm
                    ${msg.senderRole === 'teacher'
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-gray-200 border border-gray-300'}
                  `}
                >
                  <div className="flex justify-between items-start mb-1">
                    <strong className="text-gray-900">
                      {msg.senderRole === 'teacher' ? '👨‍🏫 Teacher' : '👤 Student'}
                    </strong>
                    <span className="text-xs text-gray-500">
                      {msg.timestamp?.toDate?.()
                        ?.toLocaleTimeString() || 'Now'}
                    </span>
                  </div>
                  <p className="text-gray-800">{msg.message}</p>
                  {msg.read && (
                    <span className="text-xs text-gray-500 mt-1">✓ Read</span>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatComponent;
