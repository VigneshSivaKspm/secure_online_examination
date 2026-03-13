import React, { useEffect, useState } from 'react';
import type { ToastNotification } from '../types/chat';

interface ToastProps {
  notification: ToastNotification;
  onDismiss: () => void;
}

/**
 * Toast Notification Component
 * Displays temporary notifications on the student's exam screen
 */
export const Toast: React.FC<ToastProps> = ({ notification, onDismiss }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(onDismiss, 300); // Allow animation time
    }, notification.duration);

    return () => clearTimeout(timer);
  }, [notification.duration, onDismiss]);

  const getTypeStyles = (): { bg: string; border: string; icon: string } => {
    switch (notification.type) {
      case 'message':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200 border-l-4 border-l-blue-500',
          icon: '💬',
        };
      case 'alert':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200 border-l-4 border-l-red-500',
          icon: '🚨',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200 border-l-4 border-l-yellow-500',
          icon: '⚠️',
        };
      case 'info':
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200 border-l-4 border-l-gray-500',
          icon: 'ℹ️',
        };
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200 border-l-4 border-l-green-500',
          icon: '✓',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: '•',
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className={`
        fixed top-6 right-6 max-w-sm mx-auto 
        ${styles.bg} ${styles.border} rounded-lg 
        shadow-lg p-4 z-50 transform transition-all duration-300
        ${isClosing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      role="alert"
    >
      <div className="flex gap-3">
        <div className="text-2xl flex-shrink-0 pt-0.5">{styles.icon}</div>
        <div className="flex-1">
          {notification.title && (
            <h3 className="font-semibold text-gray-900 mb-1">
              {notification.title}
            </h3>
          )}
          <p className="text-sm text-gray-700">
            {notification.message}
          </p>
          {notification.action && (
            <button
              onClick={() => {
                notification.action?.callback();
                onDismiss();
              }}
              className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              {notification.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

/**
 * Toast Container Component
 * Manages multiple toast notifications
 */
interface ToastContainerProps {
  notifications: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  notifications,
  onDismiss,
}) => {
  return (
    <div className="fixed top-0 right-0 p-4 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onDismiss={() => onDismiss(notification.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default Toast;
