import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from './Navbar';
import { ResultsTable } from './ResultsTable';
import { QuestionForm } from './QuestionForm';
import { LiveFeed } from './LiveFeed';
import type { ExamQuestion, StudentResult } from '../types/exam';
import type { StudentSession } from '../types/chat';
import { sendMessageToSession, subscribeToActiveSessions } from '../services/chatService';
import { db } from '../config/firebase';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc, deleteDoc,
} from 'firebase/firestore';

type MainTab = 'manage-exams' | 'create-exam' | 'edit-exam' | 'manage-students' | 'monitoring' | 'results';
type EditSubTab = 'questions' | 'schedule' | 'students' | 'publish';

export function TeacherPanel() {
  const { user } = useAuth();

  // ── Navigation ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<MainTab>('manage-exams');
  const [editSubTab, setEditSubTab] = useState<EditSubTab>('questions');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── Create-Exam form state ───────────────────────────────────
  const [examTitle, setExamTitle] = useState('');
  const [examDescription, setExamDescription] = useState('');

  // ── Exam list ────────────────────────────────────────────────
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);

  // ── Schedule state (per exam editor) ───────────────────────
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [scheduleEndTime, setScheduleEndTime] = useState('');

  // ── Students state ──────────────────────────────────────────
  const [students, setStudents] = useState<any[]>([]);
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<Set<string>>(new Set());

  // ── Results (fetched by ResultsTable) ───────────────────────
  const [results] = useState<StudentResult[]>([]);

  // ── Monitoring state ─────────────────────────────────────────
  const [monitoringExamId, setMonitoringExamId] = useState<string>('');
  const [monitorSessions, setMonitorSessions] = useState<StudentSession[]>([]);
  const [msgText, setMsgText] = useState('');
  const [msgType, setMsgType] = useState<'message' | 'warning'>('message');
  const [msgTarget, setMsgTarget] = useState<string>('all');
  const [msgSending, setMsgSending] = useState(false);

  // ══════════════════════════════════════════════════════════
  // Effects
  // ══════════════════════════════════════════════════════════

  // Fetch this teacher's exams
  useEffect(() => {
    if (!user) return;
    const run = async () => {
      try {
        setIsLoading(true);
        const q = query(collection(db, 'exams'), where('createdBy', '==', user.uid));
        const snap = await getDocs(q);
        setExams(
          snap.docs.map((d) => {
            const { id: _id, ...rest } = d.data();
            return { ...rest, id: d.id };
          })
        );
      } catch (e) {
        console.error('Error fetching exams:', e);
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [user]);

  // Fetch questions when selected exam changes
  useEffect(() => {
    if (!selectedExamId) { setExamQuestions([]); return; }
    const run = async () => {
      try {
        const q = query(collection(db, 'questions'), where('examId', '==', selectedExamId));
        const snap = await getDocs(q);
        setExamQuestions(
          snap.docs.map((d) => {
            const { id: _id, ...rest } = d.data() as ExamQuestion;
            return { ...rest, id: d.id } as ExamQuestion;
          })
        );
      } catch (e) {
        console.error('Error fetching questions:', e);
      }
    };
    run();
  }, [selectedExamId]);

  // Populate schedule fields & enrolled students when entering edit-exam
  useEffect(() => {
    if (activeTab !== 'edit-exam' || !selectedExamId) return;
    const exam = exams.find((e) => e.id === selectedExamId);
    if (!exam) return;

    const parseFirestoreDate = (val: any): Date | null => {
      if (!val) return null;
      if (val.toDate) return val.toDate();
      return new Date(val);
    };

    const start = parseFirestoreDate(exam.startAt);
    if (start) {
      setScheduleStartDate(start.toISOString().substring(0, 10));
      setScheduleStartTime(start.toTimeString().substring(0, 5));
    } else {
      setScheduleStartDate('');
      setScheduleStartTime('');
    }

    const end = parseFirestoreDate(exam.endAt);
    if (end) {
      setScheduleEndDate(end.toISOString().substring(0, 10));
      setScheduleEndTime(end.toTimeString().substring(0, 5));
    } else {
      setScheduleEndDate('');
      setScheduleEndTime('');
    }

    setEnrolledStudentIds(new Set<string>(exam.enrolledStudentIds ?? []));
  }, [activeTab, selectedExamId, exams]);

  // Fetch all students (role === 'student')
  useEffect(() => {
    const run = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const snap = await getDocs(q);
        setStudents(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().displayName || 'Unnamed',
            email: d.data().email ?? '',
          }))
        );
      } catch (e) {
        console.error('Error fetching students:', e);
      }
    };
    run();
  }, []);

  // Subscribe to active sessions for the selected monitoring exam
  useEffect(() => {
    if (!monitoringExamId) {
      setMonitorSessions([]);
      return;
    }
    const unsubscribe = subscribeToActiveSessions(
      monitoringExamId,
      (sessions) => setMonitorSessions(sessions),
    );
    return () => unsubscribe?.();
  }, [monitoringExamId]);

  // ── Send message/warning to student(s) ──────────────────────
  const handleSendMessage = async () => {
    if (!msgText.trim()) return;
    setMsgSending(true);
    try {
      const targets =
        msgTarget === 'all'
          ? monitorSessions
          : monitorSessions.filter((s) => s.sessionId === msgTarget);
      for (const session of targets) {
        await sendMessageToSession(session.sessionId, msgText.trim(), msgType);
      }
      setMsgText('');
      showSuccess();
    } catch (e) {
      console.error('Error sending message:', e);
      alert('Failed to send message. Please try again.');
    } finally {
      setMsgSending(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════

  const showSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const openExamEditor = (examId: string, subTab: EditSubTab = 'questions') => {
    setSelectedExamId(examId);
    setEditSubTab(subTab);
    setActiveTab('edit-exam');
  };

  const formatFirestoreDate = (val: any): string => {
    if (!val) return '—';
    const d = val.toDate ? val.toDate() : new Date(val);
    return d.toLocaleString();
  };

  // ══════════════════════════════════════════════════════════
  // Handlers: Create Exam
  // ══════════════════════════════════════════════════════════

  const handleSaveExam = async () => {
    if (!examTitle.trim()) { alert('Please enter an exam title'); return; }
    if (!user) { alert('Please log in first'); return; }
    try {
      const payload = {
        title: examTitle.trim(),
        description: examDescription.trim(),
        createdBy: user.uid,
        createdAt: new Date(),
        status: 'draft',
        enrolledStudentIds: [] as string[],
        totalPoints: 0,
        questions: 0,
        startAt: null,
        endAt: null,
      };
      const docRef = await addDoc(collection(db, 'exams'), payload);
      setExams((prev) => [...prev, { ...payload, id: docRef.id }]);
      setExamTitle('');
      setExamDescription('');
      showSuccess();
      openExamEditor(docRef.id, 'questions');
    } catch (e) {
      console.error('Error creating exam:', e);
      alert('Failed to create exam. See console for details.');
    }
  };

  // ══════════════════════════════════════════════════════════
  // Handlers: Questions
  // ══════════════════════════════════════════════════════════

  const handleAddQuestion = async (question: ExamQuestion) => {
    if (!selectedExamId || !user) return;
    try {
      const payload = {
        text: question.text,
        options: question.options,
        correctAnswer: question.correctAnswer,
        points: question.points,
        examId: selectedExamId,
        createdBy: user.uid,
        createdAt: new Date(),
      };
      const docRef = await addDoc(collection(db, 'questions'), payload);
      const saved: ExamQuestion = { ...payload, id: docRef.id };
      const updatedQuestions = [...examQuestions, saved];
      setExamQuestions(updatedQuestions);

      const currentExam = exams.find((e) => e.id === selectedExamId);
      const newTotal = (currentExam?.totalPoints ?? 0) + question.points;
      const newCount = updatedQuestions.length;
      await updateDoc(doc(db, 'exams', selectedExamId), {
        totalPoints: newTotal,
        questions: newCount,
      });
      setExams((prev) =>
        prev.map((e) =>
          e.id === selectedExamId ? { ...e, totalPoints: newTotal, questions: newCount } : e
        )
      );
      showSuccess();
    } catch (e) {
      console.error('Error adding question:', e);
    }
  };

  const handleRemoveQuestion = async (questionId: string) => {
    if (!selectedExamId) return;
    try {
      const target = examQuestions.find((q) => q.id === questionId);
      if (!target) return;
      await deleteDoc(doc(db, 'questions', questionId));
      const updated = examQuestions.filter((q) => q.id !== questionId);
      setExamQuestions(updated);

      const currentExam = exams.find((e) => e.id === selectedExamId);
      const newTotal = Math.max(0, (currentExam?.totalPoints ?? 0) - target.points);
      const newCount = updated.length;
      await updateDoc(doc(db, 'exams', selectedExamId), {
        totalPoints: newTotal,
        questions: newCount,
      });
      setExams((prev) =>
        prev.map((e) =>
          e.id === selectedExamId ? { ...e, totalPoints: newTotal, questions: newCount } : e
        )
      );
    } catch (e) {
      console.error('Error removing question:', e);
    }
  };

  // ══════════════════════════════════════════════════════════
  // Handlers: Schedule
  // ══════════════════════════════════════════════════════════

  const handleSaveSchedule = async () => {
    if (!selectedExamId) return;
    if (!scheduleStartDate || !scheduleStartTime) { alert('Please set a start date and time'); return; }
    if (!scheduleEndDate || !scheduleEndTime) { alert('Please set an end date and time'); return; }
    const startAt = new Date(`${scheduleStartDate}T${scheduleStartTime}`);
    const endAt = new Date(`${scheduleEndDate}T${scheduleEndTime}`);
    if (endAt <= startAt) { alert('End time must be after start time'); return; }
    try {
      await updateDoc(doc(db, 'exams', selectedExamId), { startAt, endAt });
      setExams((prev) =>
        prev.map((e) =>
          e.id === selectedExamId ? { ...e, startAt, endAt } : e
        )
      );
      showSuccess();
    } catch (e) {
      console.error('Error saving schedule:', e);
    }
  };

  // ══════════════════════════════════════════════════════════
  // Handlers: Student Enrollment
  // ══════════════════════════════════════════════════════════

  const toggleStudentEnrollment = (studentId: string) => {
    setEnrolledStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleSaveEnrollments = async () => {
    if (!selectedExamId) return;
    try {
      const ids = Array.from(enrolledStudentIds);
      await updateDoc(doc(db, 'exams', selectedExamId), { enrolledStudentIds: ids });
      setExams((prev) =>
        prev.map((e) =>
          e.id === selectedExamId ? { ...e, enrolledStudentIds: ids } : e
        )
      );
      showSuccess();
    } catch (e) {
      console.error('Error saving enrollments:', e);
    }
  };

  // ══════════════════════════════════════════════════════════
  // Handlers: Publish
  // ══════════════════════════════════════════════════════════

  const handlePublishToggle = async () => {
    if (!selectedExamId) return;
    const exam = exams.find((e) => e.id === selectedExamId);
    if (!exam) return;
    const newStatus = exam.status === 'published' ? 'draft' : 'published';
    try {
      await updateDoc(doc(db, 'exams', selectedExamId), { status: newStatus });
      setExams((prev) =>
        prev.map((e) =>
          e.id === selectedExamId ? { ...e, status: newStatus } : e
        )
      );
      showSuccess();
    } catch (e) {
      console.error('Error toggling publish:', e);
    }
  };

  // ══════════════════════════════════════════════════════════
  // Handlers: Delete Exam
  // ══════════════════════════════════════════════════════════

  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm('Delete this exam and all its questions? This cannot be undone.')) return;
    try {
      const q = query(collection(db, 'questions'), where('examId', '==', examId));
      const snap = await getDocs(q);
      for (const d of snap.docs) await deleteDoc(doc(db, 'questions', d.id));
      await deleteDoc(doc(db, 'exams', examId));
      setExams((prev) => prev.filter((e) => e.id !== examId));
      if (selectedExamId === examId) {
        setSelectedExamId(null);
        setExamQuestions([]);
        setActiveTab('manage-exams');
      }
      showSuccess();
    } catch (e) {
      console.error('Error deleting exam:', e);
    }
  };

  // ══════════════════════════════════════════════════════════
  // Derived state
  // ══════════════════════════════════════════════════════════

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  // ══════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* ────────── Sidebar ────────── */}
        <aside className="w-60 bg-white border-r border-gray-200 hidden md:flex flex-col overflow-y-auto shrink-0">
          <nav className="p-3 space-y-0.5 flex-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 pt-4 pb-2">
              Exams
            </p>
            {(
              [
                { tab: 'manage-exams', icon: '📋', label: 'My Exams' },
              ] as { tab: MainTab; icon: string; label: string }[]
            ).map(({ tab, icon, label }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {icon} {label}
              </button>
            ))}

            {/* Exam editor sub-nav – shown while editing */}
            {activeTab === 'edit-exam' && selectedExam && (
              <div className="mt-2 ml-3 border-l-2 border-indigo-200 pl-3 space-y-0.5">
                <p className="text-[10px] font-bold text-indigo-400 truncate py-1">
                  {selectedExam.title}
                </p>
                {(
                  [
                    { key: 'questions', icon: '❓', label: 'Questions' },
                    { key: 'schedule', icon: '🕐', label: 'Schedule' },
                    { key: 'students', icon: '👥', label: 'Students' },
                    { key: 'publish', icon: '🚀', label: 'Publish' },
                  ] as { key: EditSubTab; icon: string; label: string }[]
                ).map(({ key, icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setEditSubTab(key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      editSubTab === key
                        ? 'bg-indigo-100 text-indigo-700 font-semibold'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            )}

            <div className="pt-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 pb-2">
                Other
              </p>
              {(
                [
                  { tab: 'manage-students', icon: '👥', label: 'Students' },
                  { tab: 'monitoring', icon: '📹', label: 'Monitoring' },
                  { tab: 'results', icon: '📊', label: 'Results' },
                ] as { tab: MainTab; icon: string; label: string }[]
              ).map(({ tab, icon, label }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </nav>
        </aside>

        {/* ────────── Main Content ────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">

            {/* Global success toast */}
            {saveSuccess && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium">
                ✅ Saved successfully!
              </div>
            )}

            {/* loading indicator */}
            {isLoading && (
              <div className="mb-4 text-sm text-gray-400 flex items-center gap-2">
                <span className="animate-spin">⏳</span> Loading…
              </div>
            )}

            {/* ══════════════════════════════════════════
                MY EXAMS
            ══════════════════════════════════════════ */}
            {activeTab === 'manage-exams' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Exams</h1>
                    <p className="text-gray-500 text-sm mt-0.5">{exams.length} exam(s) created</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('create-exam')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold flex items-center gap-2 shadow-sm"
                  >
                    ➕ Create Exam
                  </button>
                </div>

                {exams.length === 0 ? (
                  <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
                    <p className="text-5xl mb-4">📝</p>
                    <h3 className="text-lg font-bold text-gray-900">No exams yet</h3>
                    <p className="text-gray-500 text-sm mt-1 mb-6">
                      Create your first exam to get started
                    </p>
                    <button
                      onClick={() => setActiveTab('create-exam')}
                      className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm"
                    >
                      Create Exam
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {exams.map((exam) => (
                      <div
                        key={exam.id}
                        className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all overflow-hidden group cursor-pointer"
                      >
                        {/* Main clickable area */}
                        <div
                          onClick={() => openExamEditor(exam.id, 'questions')}
                          className="p-5 hover:bg-gray-50 transition-colors"
                        >
                          {/* Header */}
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-indigo-600 group-hover:text-indigo-700 truncate">
                                  {exam.title}
                                </h3>
                                <span
                                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                                    exam.status === 'published'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {exam.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mt-0.5 truncate">
                                {exam.description || 'No description'}
                              </p>
                            </div>
                            {/* Edit badge */}
                            <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              ✏️ Edit
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-4 gap-2 mt-4">
                            {[
                              { label: 'Questions', value: exam.questions ?? 0, color: 'text-indigo-600' },
                              { label: 'Total Pts', value: exam.totalPoints ?? 0, color: 'text-emerald-600' },
                              {
                                label: 'Start',
                                value: exam.startAt ? (exam.startAt.toDate ? exam.startAt.toDate() : new Date(exam.startAt)).toLocaleDateString() : '—',
                                color: 'text-blue-600',
                              },
                              {
                                label: 'Enrolled',
                                value: (exam.enrolledStudentIds ?? []).length,
                                color: 'text-purple-600',
                              },
                            ].map(({ label, value, color }) => (
                              <div
                                key={label}
                                className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 text-center"
                              >
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                                  {label}
                                </p>
                                <p className={`text-lg font-black ${color} mt-0.5`}>{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Quick action buttons footer */}
                        <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 flex gap-1.5 flex-wrap">
                            <button
                              onClick={() => openExamEditor(exam.id, 'questions')}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                            >
                              ❓ Questions
                            </button>
                            <button
                              onClick={() => openExamEditor(exam.id, 'schedule')}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                            >
                              🕐 Schedule
                            </button>
                            <button
                              onClick={() => openExamEditor(exam.id, 'students')}
                              className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors"
                            >
                              👥 Students
                            </button>
                            <button
                              onClick={() => openExamEditor(exam.id, 'publish')}
                              className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
                            >
                              🚀 Publish
                            </button>
                            <div className="flex-1"></div>
                            <button
                              onClick={() => handleDeleteExam(exam.id)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                            >
                              🗑️ Delete
                            </button>
                          </div>

                        {/* Schedule info footer */}
                        {exam.startAt && (
                          <div className="mt-3 flex gap-4 text-xs text-gray-400 font-medium border-t border-gray-100 pt-3 px-5 pb-4">
                            <span>🕐 Starts: {formatFirestoreDate(exam.startAt)}</span>
                            {exam.endAt && <span>🕑 Ends: {formatFirestoreDate(exam.endAt)}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════
                CREATE EXAM
            ══════════════════════════════════════════ */}
            {activeTab === 'create-exam' && (
              <div className="max-w-xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Create New Exam</h1>
                <p className="text-gray-500 text-sm mb-6">
                  Fill in the basic details. You'll add questions, a schedule and enroll students
                  next.
                </p>

                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      Exam Title *
                    </label>
                    <input
                      type="text"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder="e.g. Physics Midterm 2026"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={examDescription}
                      onChange={(e) => setExamDescription(e.target.value)}
                      placeholder="Topics covered, instructions for students…"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleSaveExam}
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors text-sm shadow-sm"
                    >
                      Create Exam →
                    </button>
                    <button
                      onClick={() => setActiveTab('manage-exams')}
                      className="px-5 py-3 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-400 text-center mt-4">
                  After creating, you'll be guided to add questions, set a schedule &amp; enrol
                  students.
                </p>
              </div>
            )}

            {/* ══════════════════════════════════════════
                EDIT EXAM  (multi-step sub-tabs)
            ══════════════════════════════════════════ */}
            {activeTab === 'edit-exam' && selectedExam && (
              <div>
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
                  <button
                    onClick={() => setActiveTab('manage-exams')}
                    className="hover:text-indigo-600 transition-colors"
                  >
                    My Exams
                  </button>
                  <span>/</span>
                  <span className="font-semibold text-gray-900 truncate max-w-xs">
                    {selectedExam.title}
                  </span>
                  <span
                    className={`ml-2 text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      selectedExam.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {selectedExam.status}
                  </span>
                </div>

                {/* Sub-tab pill nav */}
                <div className="flex gap-1 mb-7 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
                  {(
                    [
                      { key: 'questions', label: '❓ Questions', count: examQuestions.length },
                      { key: 'schedule', label: '🕐 Schedule', count: null },
                      { key: 'students', label: '👥 Students', count: enrolledStudentIds.size },
                      { key: 'publish', label: '🚀 Publish', count: null },
                    ] as { key: EditSubTab; label: string; count: number | null }[]
                  ).map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setEditSubTab(key)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        editSubTab === key
                          ? 'bg-white shadow-sm text-indigo-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {label}
                      {count !== null && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                            editSubTab === key
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* ── Questions Sub-tab ── */}
                {editSubTab === 'questions' && (
                  <div className="space-y-6">
                    {/* Add question form (reuses existing QuestionForm component) */}
                    <QuestionForm onAddQuestion={handleAddQuestion} />

                    {/* Question list */}
                    {examQuestions.length > 0 ? (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                          <h3 className="font-bold text-gray-900">
                            Question Bank ({examQuestions.length})
                          </h3>
                          <span className="text-sm text-gray-500">
                            Total:{' '}
                            <span className="font-bold text-emerald-600">
                              {selectedExam.totalPoints ?? 0} pts
                            </span>
                          </span>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {examQuestions.map((q, idx) => (
                            <div key={q.id} className="p-5">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                      Q{idx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                      {q.points} pts
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold text-gray-900 mb-3">
                                    {q.text}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {q.options.map((opt) => (
                                      <div
                                        key={opt.id}
                                        className={`text-xs px-3 py-2 rounded-lg border ${
                                          opt.id === q.correctAnswer
                                            ? 'bg-green-50 border-green-300 text-green-700 font-bold'
                                            : 'bg-gray-50 border-gray-200 text-gray-600'
                                        }`}
                                      >
                                        {opt.id === q.correctAnswer && '✓ '}
                                        {opt.text}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveQuestion(q.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                                  title="Delete question"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
                        <p className="text-3xl mb-2">❓</p>
                        <p className="font-semibold">No questions yet</p>
                        <p className="text-sm mt-1">Use the form above to add your first question</p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={() => setEditSubTab('schedule')}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors"
                      >
                        Next: Set Schedule →
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Schedule Sub-tab ── */}
                {editSubTab === 'schedule' && (
                  <div className="max-w-lg space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                      <h2 className="font-bold text-gray-900 text-lg">📅 Exam Schedule</h2>
                      <p className="text-sm text-gray-500">Set the exact window during which students can take this exam.</p>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">🕐 Start Date &amp; Time *</label>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="date"
                            value={scheduleStartDate}
                            onChange={(e) => setScheduleStartDate(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                          <input
                            type="time"
                            value={scheduleStartTime}
                            onChange={(e) => setScheduleStartTime(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">🕑 End Date &amp; Time *</label>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="date"
                            value={scheduleEndDate}
                            onChange={(e) => setScheduleEndDate(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                          <input
                            type="time"
                            value={scheduleEndTime}
                            onChange={(e) => setScheduleEndTime(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                      </div>

                      {scheduleStartDate && scheduleStartTime && scheduleEndDate && scheduleEndTime && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                          ⏰ Students can take this exam from <strong>{scheduleStartDate} {scheduleStartTime}</strong> to <strong>{scheduleEndDate} {scheduleEndTime}</strong>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleSaveSchedule}
                          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors text-sm"
                        >
                          Save Schedule
                        </button>
                        <button
                          onClick={() => setEditSubTab('students')}
                          className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-50 text-sm"
                        >
                          Next: Enrol Students →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Students Sub-tab ── */}
                {editSubTab === 'students' && (
                  <div className="max-w-2xl space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                        <div>
                          <h2 className="font-bold text-gray-900">Enrol Students</h2>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {enrolledStudentIds.size} of {students.length} selected
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setEnrolledStudentIds(new Set(students.map((s) => s.id)))
                            }
                            className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => setEnrolledStudentIds(new Set())}
                            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {students.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                          <p className="text-4xl mb-2">👤</p>
                          <p className="font-semibold">No students registered yet</p>
                          <p className="text-sm mt-1">
                            Students need to sign up with the "Student" role first
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                          {students.map((student) => (
                            <label
                              key={student.id}
                              className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={enrolledStudentIds.has(student.id)}
                                onChange={() => toggleStudentEnrollment(student.id)}
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">
                                  {student.name}
                                </p>
                                <p className="text-xs text-gray-500">{student.email}</p>
                              </div>
                              {enrolledStudentIds.has(student.id) && (
                                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                  Enrolled
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}

                      <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                        <span className="text-sm text-gray-500">
                          {enrolledStudentIds.size} student(s) will be enrolled
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEnrollments}
                            className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-indigo-700 text-sm"
                          >
                            Save Enrollments
                          </button>
                          <button
                            onClick={() => setEditSubTab('publish')}
                            className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg font-semibold hover:bg-gray-50 text-sm"
                          >
                            Next: Publish →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Publish Sub-tab ── */}
                {editSubTab === 'publish' && (
                  <div className="max-w-xl space-y-4">
                    {/* Summary card */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h2 className="font-bold text-gray-900 text-lg mb-4">Exam Summary</h2>
                      <dl className="space-y-3">
                        {(
                          [
                            ['Title', selectedExam.title],
                            ['Description', selectedExam.description || '—'],
                            ['Questions', `${examQuestions.length} question(s)`],
                            ['Total Points', `${selectedExam.totalPoints ?? 0} pts`],
                            ['Start Time',
                              scheduleStartDate && scheduleStartTime
                                ? `${scheduleStartDate} at ${scheduleStartTime}`
                                : selectedExam.startAt
                                ? formatFirestoreDate(selectedExam.startAt)
                                : 'Not set',
                            ],
                            ['End Time',
                              scheduleEndDate && scheduleEndTime
                                ? `${scheduleEndDate} at ${scheduleEndTime}`
                                : selectedExam.endAt
                                ? formatFirestoreDate(selectedExam.endAt)
                                : 'Not set',
                            ],
                            ['Enrolled Students', `${enrolledStudentIds.size} student(s)`],
                          ] as [string, string][]
                        ).map(([label, value]) => (
                          <div key={label} className="flex justify-between text-sm">
                            <dt className="text-gray-500 font-medium">{label}</dt>
                            <dd className="font-semibold text-gray-900 text-right max-w-xs">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    {/* Checklist warnings */}
                    {examQuestions.length === 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700 flex items-start gap-2">
                        <span>⚠️</span>
                        <span>
                          This exam has no questions yet.{' '}
                          <button
                            onClick={() => setEditSubTab('questions')}
                            className="font-bold underline hover:no-underline"
                          >
                            Add questions first.
                          </button>
                        </span>
                      </div>
                    )}
                    {enrolledStudentIds.size === 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700 flex items-start gap-2">
                        <span>⚠️</span>
                        <span>
                          No students enrolled yet.{' '}
                          <button
                            onClick={() => setEditSubTab('students')}
                            className="font-bold underline hover:no-underline"
                          >
                            Enrol students.
                          </button>
                        </span>
                      </div>
                    )}

                    {/* Publish action */}
                    <div
                      className={`rounded-xl border p-6 flex justify-between items-center ${
                        selectedExam.status === 'published'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">
                          {selectedExam.status === 'published'
                            ? '✅ Exam is Live'
                            : '📭 Exam is a Draft'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {selectedExam.status === 'published'
                            ? 'Students can see and take this exam'
                            : 'Publish to make it visible to enrolled students'}
                        </p>
                      </div>
                      <button
                        onClick={handlePublishToggle}
                        className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
                          selectedExam.status === 'published'
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100'
                        }`}
                      >
                        {selectedExam.status === 'published' ? 'Unpublish' : '🚀 Publish Exam'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════
                STUDENTS overview
            ══════════════════════════════════════════ */}
            {activeTab === 'manage-students' && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Students</h1>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-sm text-gray-500">
                      {students.length} registered student(s)
                    </p>
                  </div>
                  {students.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      <p className="text-4xl mb-2">👤</p>
                      <p className="font-semibold">No students yet</p>
                      <p className="text-sm mt-1">
                        Students must sign up via the registration page with the Student role
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {students.map((s) => {
                        const enrolledIn = exams.filter((e) =>
                          (e.enrolledStudentIds ?? []).includes(s.id)
                        );
                        return (
                          <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                {(s.name as string)?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                                <p className="text-xs text-gray-500">{s.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                Enrolled in{' '}
                                <span className="font-bold text-indigo-600">
                                  {enrolledIn.length}
                                </span>{' '}
                                exam(s)
                              </span>
                              {enrolledIn.slice(0, 2).map((e) => (
                                <span
                                  key={e.id}
                                  className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium"
                                >
                                  {(e.title as string).substring(0, 12)}…
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                MONITORING
            ══════════════════════════════════════════ */}
            {activeTab === 'monitoring' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">Live Monitoring</h1>
                  {exams.length > 0 && (
                    <select
                      value={monitoringExamId}
                      onChange={(e) => { setMonitoringExamId(e.target.value); setMsgTarget('all'); }}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">— Select an Exam to Monitor —</option>
                      {exams.map((e) => (
                        <option key={e.id} value={e.id}>{e.title}</option>
                      ))}
                    </select>
                  )}
                </div>

                {!monitoringExamId ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                    <p className="text-4xl mb-3">📹</p>
                    <p className="text-gray-500 font-medium">Select an exam above to start monitoring</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Live student feed */}
                    <LiveFeed examId={monitoringExamId} />

                    {/* Send message / warning panel */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-4">📨 Send Message to Students</h2>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        {/* Type selector */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Type</label>
                          <select
                            value={msgType}
                            onChange={(e) => setMsgType(e.target.value as 'message' | 'warning')}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          >
                            <option value="message">💬 Message</option>
                            <option value="warning">⚠️ Warning</option>
                          </select>
                        </div>

                        {/* Target selector */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Send To</label>
                          <select
                            value={msgTarget}
                            onChange={(e) => setMsgTarget(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          >
                            <option value="all">All Active Students ({monitorSessions.length})</option>
                            {monitorSessions.map((s) => (
                              <option key={s.sessionId} value={s.sessionId}>
                                {s.studentName} ({s.studentEmail})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Message input */}
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={msgText}
                          onChange={(e) => setMsgText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !msgSending && handleSendMessage()}
                          placeholder={msgType === 'warning' ? 'Enter warning message...' : 'Enter message to students...'}
                          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={msgSending || !msgText.trim() || monitorSessions.length === 0}
                          className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            msgType === 'warning'
                              ? 'bg-orange-500 hover:bg-orange-600 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {msgSending ? 'Sending…' : msgType === 'warning' ? '⚠️ Send Warning' : '💬 Send'}
                        </button>
                      </div>

                      {monitorSessions.length === 0 && (
                        <p className="text-xs text-gray-400 mt-2">No active students right now — messages will be delivered once students join.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════
                RESULTS
            ══════════════════════════════════════════ */}
            {activeTab === 'results' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">Student Results</h1>
                  {exams.length > 0 && (
                    <select
                      onChange={(e) => setSelectedExamId(e.target.value || null)}
                      value={selectedExamId ?? ''}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">All Exams</option>
                      {exams.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <ResultsTable examId={selectedExamId ?? 'all'} results={results} />
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
