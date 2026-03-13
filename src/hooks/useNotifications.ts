/**
 * useNotifications Hook for Students
 * Listens to teacher messages and broadcasts notifications as toasts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  subscribeToStudentMessages,
  subscribeToNotifications,
  markMessageAsRead,
  dismissNotification,
} from '../services/chatService';
import type { ToastNotification, ChatMessage } from '../types/chat';

export interface UseNotificationsOptions {
  studentId: string;
  examId: string;
  enabled?: boolean;
}

export const useNotifications = (options: UseNotificationsOptions) => {
  const { studentId, examId, enabled = true } = options;
  
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * Handle incoming message - convert to toast notification
   */
  const handleMessageReceived = useCallback((messages: ChatMessage[]) => {
    // Get messages that haven't been displayed yet
    const unreadMessages = messages.filter((msg) => !msg.read);

    unreadMessages.forEach((msg) => {
      // Create toast notification
      const toast: ToastNotification = {
        id: msg.id,
        type: msg.priority === 'high' ? 'alert' : 'message',
        title: msg.senderRole === 'teacher' ? '👨‍🏫 Teacher' : '📢 Notification',
        message: msg.message,
        duration: msg.priority === 'high' ? 8000 : 5000, // Longer for alerts
        action:
          msg.priority === 'high'
            ? {
                label: 'OK',
                callback: () => {
                  // Mark as read
                  markMessageAsRead(msg.id).catch(console.error);
                },
              }
            : undefined,
      };

      // Add to notifications state
      setNotifications((prev) => {
        // Avoid duplicates
        if (prev.some((n) => n.id === toast.id)) {
          return prev;
        }
        return [...prev, toast];
      });

      // Mark message as read after 1 second
      setTimeout(() => {
        markMessageAsRead(msg.id).catch(console.error);
      }, 1000);

      // Play sound for high priority
      if (msg.priority === 'high') {
        playNotificationSound();
      }
    });

    // Update unread count
    setUnreadCount(unreadMessages.length);
  }, []);

  /**
   * Handle incoming notifications
   */
  const handleNotificationsReceived = useCallback((incomingNotifications: any[]) => {
    incomingNotifications.forEach((notif) => {
      const toast: ToastNotification = {
        id: notif.id,
        type: notif.type || 'info',
        title: notif.title,
        message: notif.message,
        duration: 6000,
        action: {
          label: 'Dismiss',
          callback: () => {
            dismissNotification(notif.id).catch(console.error);
          },
        },
      };

      setNotifications((prev) => {
        if (prev.some((n) => n.id === toast.id)) {
          return prev;
        }
        return [...prev, toast];
      });

      // Auto-dismiss critical notifications require manual action
      if (notif.type === 'alert' || notif.type === 'warning') {
        playNotificationSound();
      }
    });
  }, []);

  /**
   * Play notification sound
   */
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create notification tone (different from RED alert)
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Play a rising tone: 800Hz then 1200Hz
      oscillator.frequency.setValueAtTime(800, now);
      oscillator.frequency.linearRampToValueAtTime(1200, now + 0.2);

      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      oscillator.start(now);
      oscillator.stop(now + 0.3);

      console.log('🔔 Notification sound played');
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  /**
   * Remove notification from display
   */
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /**
   * Dismiss all notifications
   */
  const dismissAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  /**
   * Subscribe to messages and notifications
   */
  useEffect(() => {
    if (!enabled || !studentId || !examId) {
      return;
    }

    // Subscribe to teacher messages
    const unsubscribeMessages = subscribeToStudentMessages(
      studentId,
      examId,
      handleMessageReceived,
      (error) => {
        console.error('Error in messages subscription:', error);
      }
    );

    // Subscribe to notifications
    const unsubscribeNotifications = subscribeToNotifications(
      studentId,
      examId,
      handleNotificationsReceived
    );

    return () => {
      unsubscribeMessages?.();
      unsubscribeNotifications?.();
    };
  }, [enabled, studentId, examId, handleMessageReceived, handleNotificationsReceived]);

  return {
    notifications,
    unreadCount,
    removeNotification,
    dismissAll,
  };
};

export default useNotifications;
