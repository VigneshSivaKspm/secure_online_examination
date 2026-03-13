import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import TeacherExamMonitor from '../components/TeacherExamMonitor';

/**
 * ExamMonitoringPage Component
 * 
 * Teacher dashboard for monitoring live exams
 * Shows real-time status of all students taking the exam
 */
export function ExamMonitoringPage() {
  const { examId } = useParams<{ examId: string }>();
  const [notifications, setNotifications] = useState<any[]>([]);

  // Store notification for 5 seconds then fade out
  const handleNewAlert = (alert: any) => {
    const notification = {
      id: Date.now(),
      ...alert,
    };
    setNotifications((prev) => [notification, ...prev]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    }, 5000);

    // Try to play notification sound
    playNotificationSound();
  };

  /**
   * Play notification sound
   */
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 1200; // Higher pitch for alerts
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.8);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  if (!examId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-6 px-4">
          <div className="bg-red-50 p-6 rounded-lg border border-red-200">
            <h2 className="text-2xl font-bold text-red-900">Error</h2>
            <p className="text-red-700 mt-2">No exam ID provided for monitoring.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <span>📊</span> Live Exam Monitoring
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor all students in real-time as they take the exam. Watch for suspicious activity alerts.
          </p>
        </div>

        {/* Active Notifications */}
        <div className="fixed bottom-4 right-4 space-y-2 max-w-sm z-40">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="bg-red-600 text-white p-4 rounded-lg shadow-lg animate-pulse"
            >
              <p className="font-bold">🚨 Alert: {notif.studentName}</p>
              <p className="text-sm mt-1">
                {notif.status === 'RED' ? 'Suspicious activity detected' : 'Status changed to critical'}
              </p>
            </div>
          ))}
        </div>

        {/* Monitoring Dashboard */}
        <div className="bg-white rounded-lg shadow p-6">
          <TeacherExamMonitor examId={examId} onNewAlert={handleNewAlert} />
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="font-bold text-blue-900 mb-2">📌 Monitoring Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>GREEN status</strong> - Student is behaving normally</li>
            <li>• <strong>YELLOW status</strong> - Minor suspicious activity detected</li>
            <li>• <strong>RED status</strong> - Significant suspicious activity (head turning away)</li>
            <li>• <strong>3 Warnings</strong> - Student has reached the critical threshold and will see a warning popup</li>
            <li>• Refresh the page to get the latest data if needed</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default ExamMonitoringPage;
