/**
 * Chat and Messaging Type Definitions
 */

/**
 * Chat message sent between teacher and student
 */
export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: 'teacher' | 'student';
  senderName: string;
  examId?: string;
  message: string;
  timestamp: any; // Firebase Timestamp
  read: boolean;
  type: 'text' | 'alert' | 'notification';
  priority?: 'low' | 'normal' | 'high'; // For notifications
}

/**
 * Active student session in live feed
 */
export interface StudentSession {
  sessionId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  examId: string;
  examTitle?: string;
  startTime: any; // Firebase Timestamp
  lastHeartbeat: any; // Firebase Timestamp
  currentQuestion: number;
  answeredCount: number;
  proctoringStatus: 'GREEN' | 'YELLOW' | 'RED';
  alertCount: number;
  timeRemaining: number; // In seconds
  isActive: boolean;
  connectionStatus: 'online' | 'offline' | 'idle';
  cameraStatus?: 'active' | 'inactive' | 'disabled';
  micStatus?: 'active' | 'inactive' | 'disabled';
  screenLocked?: boolean;
  eyeGazeStatus?: 'focused' | 'looking_away' | 'unknown';
  recentActivity?: ActivityEvent[];
}

/**
 * Student activity event for tracking behavior
 */
export interface ActivityEvent {
  timestamp: any;
  type: 'page_focus' | 'page_blur' | 'mouse_move' | 'key_press' | 'copy_paste' | 'right_click' | 'tab_switch' | 'answer_selected' | 'question_jumped' | 'camera_detected' | 'face_detected';
  severity: 'normal' | 'warning' | 'critical';
  details?: string;
}

/**
 * Notification for toast display
 */
export interface ToastNotification {
  id: string;
  type: 'message' | 'alert' | 'warning' | 'info' | 'success';
  title?: string;
  message: string;
  duration: number; // milliseconds
  action?: {
    label: string;
    callback: () => void;
  };
}

/**
 * Alert event (RED status, cheating detected, etc.)
 */
export interface AlertEvent {
  id: string;
  studentId: string;
  sessionId: string;
  type: 'cheating' | 'multiple_faces' | 'looking_away' | 'mouth_detected' | 'disconnected' | 'timeout';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: any; // Firebase Timestamp
  requiresTeacherAction: boolean;
}

/**
 * Teacher notification preferences
 */
export interface NotificationPreferences {
  soundEnabled: boolean;
  soundVolume: number; // 0-100
  highlightRedStatus: boolean;
  autoHighlight: boolean;
  messageNotifications: boolean;
  alertNotifications: boolean;
}

/**
 * Chat room (collection of messages for an exam)
 */
export interface ChatRoom {
  id: string;
  examId: string;
  teacherId: string;
  participants: string[]; // Student IDs
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
  messageCount: number;
  isActive: boolean;
}

/**
 * Real-time status update
 */
export interface StatusUpdate {
  studentId: string;
  sessionId: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  previousStatus: 'GREEN' | 'YELLOW' | 'RED';
  reason?: string;
  timestamp: any; // Firebase Timestamp
}
