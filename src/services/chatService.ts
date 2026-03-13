/**
 * Chat and Messaging Service
 * Handles real-time messaging between teachers and students
 */

import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  ChatMessage,
  StudentSession,
  AlertEvent,
  ActivityEvent,
} from '../types/chat';

/**
 * Send a message from teacher to student(s)
 */
export const sendTeacherMessage = async (
  teacherId: string,
  examId: string,
  studentIds: string[], // 'all' or specific student IDs
  message: string,
  priority: 'low' | 'normal' | 'high' = 'normal'
): Promise<string> => {
  try {
    const messageRef = await addDoc(collection(db, 'chat_messages'), {
      senderId: teacherId,
      senderRole: 'teacher',
      senderName: 'Teacher',
      examId,
      message,
      studentIds, // Recipients
      timestamp: serverTimestamp(),
      read: false,
      type: 'text',
      priority,
      createdAt: serverTimestamp(),
    });

    console.log('✅ Teacher message sent:', messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error('Error sending teacher message:', error);
    throw error;
  }
};

/**
 * Send a toast notification to students
 */
export const sendNotificationToast = async (
  teacherId: string,
  examId: string,
  studentIds: string[],
  title: string,
  message: string,
  type: 'alert' | 'warning' | 'info' = 'info'
): Promise<string> => {
  try {
    const notifRef = await addDoc(collection(db, 'notifications'), {
      teacherId,
      examId,
      studentIds,
      title,
      message,
      type,
      timestamp: serverTimestamp(),
      read: false,
      dismissed: false,
    });

    console.log('✅ Notification sent:', notifRef.id);
    return notifRef.id;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

/**
 * Subscribe to messages for a student
 */
export const subscribeToStudentMessages = (
  studentId: string,
  examId: string,
  callback: (messages: ChatMessage[]) => void,
  errorCallback?: (error: any) => void
) => {
  try {
    const q = query(
      collection(db, 'chat_messages'),
      where('examId', '==', examId),
      where('studentIds', 'array-contains', studentId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messages: ChatMessage[] = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as ChatMessage))
          .sort((a, b) => {
            const aTime = a.timestamp?.toDate?.().getTime() || 0;
            const bTime = b.timestamp?.toDate?.().getTime() || 0;
            return bTime - aTime;
          })
          .slice(0, 50);

        callback(messages);
      },
      (error) => {
        console.error('Error subscribed to student messages:', error);
        errorCallback?.(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up message subscription:', error);
    throw error;
  }
};

/**
 * Subscribe to notifications for a student
 */
export const subscribeToNotifications = (
  studentId: string,
  examId: string,
  callback: (notifications: any[]) => void
) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('examId', '==', examId),
      where('studentIds', 'array-contains', studentId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs
        .filter((doc) => doc.data().dismissed !== true)
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as any))
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate?.().getTime() || 0;
          const bTime = b.timestamp?.toDate?.().getTime() || 0;
          return bTime - aTime;
        });

      callback(notifications);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    throw error;
  }
};

/**
 * Mark message as read
 */
export const markMessageAsRead = async (messageId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'chat_messages', messageId), {
      read: true,
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
};

/**
 * Mark notification as dismissed
 */
export const dismissNotification = async (notificationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      dismissed: true,
    });
  } catch (error) {
    console.error('Error dismissing notification:', error);
  }
};

/**
 * Register a student's active session
 */
export const registerStudentSession = async (
  sessionId: string,
  studentId: string,
  studentName: string,
  studentEmail: string,
  examId: string,
  examTitle: string
): Promise<void> => {
  try {
    const sessionRef = doc(db, 'active_sessions', sessionId);
    await setDoc(sessionRef, {
      sessionId,
      studentId,
      studentName,
      studentEmail,
      examId,
      examTitle,
      startTime: serverTimestamp(),
      lastHeartbeat: serverTimestamp(),
      currentQuestion: 0,
      answeredCount: 0,
      proctoringStatus: 'GREEN',
      alertCount: 0,
      timeRemaining: 30 * 60, // 30 minutes
      isActive: true,
      connectionStatus: 'online',
    });

    console.log('✅ Student session registered:', sessionId);
  } catch (error) {
    console.error('Error registering student session:', error);
    throw error;
  }
};

/**
 * Update session status and send alert if RED
 */
export const updateSessionStatus = async (
  sessionId: string,
  studentId: string,
  status: 'GREEN' | 'YELLOW' | 'RED',
  alertCount: number,
  previousStatus?: 'GREEN' | 'YELLOW' | 'RED'
): Promise<boolean> => {
  try {
    const sessionRef = doc(db, 'active_sessions', sessionId);
    
    // Use setDoc with merge to create or update the document
    // This prevents "No document to update" errors
    await setDoc(sessionRef, {
      proctoringStatus: status,
      alertCount,
      lastHeartbeat: serverTimestamp(),
    }, { merge: true });

    // If status changed to RED, log alert event
    if (status === 'RED' && previousStatus !== 'RED') {
      await logAlertEvent(sessionId, studentId, 'multiple_faces', 'critical', 'RED status triggered');
    }

    console.log('✅ Session status updated:', { sessionId, status });
    return status === 'RED';
  } catch (error) {
    console.error('Error updating session status:', error);
    // Don't throw - allow the app to continue even if update fails
    return false;
  }
};

/**
 * Subscribe to active sessions for a teacher
 */
export const subscribeToActiveSessions = (
  examId: string,
  callback: (sessions: StudentSession[]) => void,
  errorCallback?: (error: any) => void
) => {
  try {
    // Query only by examId to avoid composite index requirement
    // Filter isActive and sort in-memory instead
    const q = query(
      collection(db, 'active_sessions'),
      where('examId', '==', examId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filter isActive and sort by lastHeartbeat in memory
        const sessions: StudentSession[] = snapshot.docs
          .filter((doc) => doc.data().isActive === true)
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as unknown as StudentSession))
          .sort((a, b) => {
            const aTime = a.lastHeartbeat?.toDate?.().getTime() || 0;
            const bTime = b.lastHeartbeat?.toDate?.().getTime() || 0;
            return bTime - aTime; // Descending order
          });

        callback(sessions);
      },
      (error) => {
        console.error('Error subscribing to active sessions:', error);
        errorCallback?.(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up session subscription:', error);
    throw error;
  }
};

/**
 * End a student session
 */
export const endStudentSession = async (sessionId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'active_sessions', sessionId), {
      isActive: false,
      connectionStatus: 'offline',
      lastHeartbeat: serverTimestamp(),
    });

    console.log('✅ Session ended:', sessionId);
  } catch (error) {
    console.error('Error ending session:', error);
  }
};

/**
 * Log an alert event (cheating detection, etc.)
 */
export const logAlertEvent = async (
  sessionId: string,
  studentId: string,
  type: string,
  severity: 'warning' | 'critical',
  message: string
): Promise<void> => {
  try {
    await addDoc(collection(db, 'alert_events'), {
      sessionId,
      studentId,
      type,
      severity,
      message,
      timestamp: serverTimestamp(),
      requiresTeacherAction: severity === 'critical',
    });

    console.log('✅ Alert event logged:', { sessionId, type, severity });
  } catch (error) {
    console.error('Error logging alert event:', error);
  }
};

/**
 * Subscribe to alert events for a teacher
 */
export const subscribeToAlertEvents = (
  examId: string,
  callback: (alerts: AlertEvent[]) => void
) => {
  try {
    // Query without the complex composite filters to avoid index requirements
    // Filter severity and limit in memory instead
    const q = query(
      collection(db, 'alert_events'),
      where('examId', '==', examId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts: AlertEvent[] = snapshot.docs
        .filter((doc) => doc.data().severity === 'critical')
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as AlertEvent))
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate?.().getTime() || 0;
          const bTime = b.timestamp?.toDate?.().getTime() || 0;
          return bTime - aTime; // Descending order
        })
        .slice(0, 100); // Limit to 100

      callback(alerts);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to alert events:', error);
    throw error;
  }
};

/**
 * Send a RED status alert notification
 */
export const broadcastRedStatusAlert = async (
  teacherId: string,
  examId: string,
  studentId: string,
  studentName: string,
  reason: string
): Promise<void> => {
  try {
    // Log the alert event
    await logAlertEvent(
      `exam_${examId}`, 
      studentId, 
      'red_status', 
      'critical',
      `${studentName} has RED status: ${reason}`
    );

    // Also send as notification
    await sendNotificationToast(
      teacherId,
      examId,
      [studentId],
      '⚠️ RED Status Alert',
      `${studentName} has been flagged for suspicious activity`,
      'alert'
    );

    console.log('✅ RED status alert broadcast:', studentName);
  } catch (error) {
    console.error('Error broadcasting RED status alert:', error);
  }
};

/**
 * Get message history between teacher and students
 */
export const getMessageHistory = async (
  examId: string,
  maxResults: number = 100
): Promise<ChatMessage[]> => {
  try {
    const q = query(
      collection(db, 'chat_messages'),
      where('examId', '==', examId)
    );

    const snapshot = await getDocs(q);
    const messages: ChatMessage[] = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ChatMessage))
      .sort((a, b) => {
        const aTime = a.timestamp?.toDate?.().getTime() || 0;
        const bTime = b.timestamp?.toDate?.().getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, Math.min(maxResults, 100));

    return messages;
  } catch (error) {
    console.error('Error fetching message history:', error);
    return [];
  }
};

/**
 * Get all active sessions for an exam (non-reactive, one-time fetch)
 */
export const getActiveSessions = async (examId: string): Promise<StudentSession[]> => {
  try {
    const q = query(
      collection(db, 'active_sessions'),
      where('examId', '==', examId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const sessions: StudentSession[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as unknown as StudentSession));

    return sessions;
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    return [];
  }
};

/**
 * Update session heartbeat (to keep session alive)
 */
export const updateSessionHeartbeat = async (sessionId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'active_sessions', sessionId), {
      lastHeartbeat: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating session heartbeat:', error);
  }
};

/**
 * Send bulk message to all active students
 */
export const sendBulkMessage = async (
  teacherId: string,
  examId: string,
  message: string,
  sessions: StudentSession[]
): Promise<string> => {
  try {
    const studentIds = sessions.map((s) => s.studentId);

    const messageRef = await addDoc(collection(db, 'chat_messages'), {
      senderId: teacherId,
      senderRole: 'teacher',
      senderName: 'Teacher',
      examId,
      message,
      studentIds,
      timestamp: serverTimestamp(),
      read: false,
      type: 'text',
      priority: 'normal',
      broadcast: true,
    });

    console.log('✅ Bulk message sent to', studentIds.length, 'students');
    return messageRef.id;
  } catch (error) {
    console.error('Error sending bulk message:', error);
    throw error;
  }
};

/**
 * Send a direct message or warning to a specific student session.
 * Writes to live_sessions/{sessionId}/messages which ExamRoom listens to.
 */
export const sendMessageToSession = async (
  sessionId: string,
  message: string,
  type: 'message' | 'warning' = 'message'
): Promise<void> => {
  try {
    await addDoc(collection(db, 'live_sessions', sessionId, 'messages'), {
      message,
      type,
      timestamp: serverTimestamp(),
    });
    console.log('✅ Message sent to session:', sessionId);
  } catch (error) {
    console.error('Error sending message to session:', error);
    throw error;
  }
};

/**
 * Log a student activity event (suspicious behavior tracking)
 */
export const logStudentActivity = async (
  sessionId: string,
  type: ActivityEvent['type'],
  severity: 'normal' | 'warning' | 'critical' = 'normal',
  details?: string
): Promise<void> => {
  try {
    await addDoc(collection(db, 'live_sessions', sessionId, 'activities'), {
      type,
      severity,
      timestamp: serverTimestamp(),
      details,
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Subscribe to live activity feed for a session
 */
export const subscribeToSessionActivities = (
  sessionId: string,
  callback: (activities: ActivityEvent[]) => void
) => {
  try {
    const q = query(
      collection(db, 'live_sessions', sessionId, 'activities')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activities: ActivityEvent[] = snapshot.docs
        .map((doc) => ({
          timestamp: doc.data().timestamp,
          type: doc.data().type as ActivityEvent['type'],
          severity: doc.data().severity as ActivityEvent['severity'],
          details: doc.data().details,
        }))
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate?.().getTime() || 0;
          const bTime = b.timestamp?.toDate?.().getTime() || 0;
          return bTime - aTime;
        })
        .slice(0, 50);
      callback(activities);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to activities:', error);
  }
};
