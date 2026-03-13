import { collection, getDocs, doc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ExamQuestion } from '../types/exam';

/**
 * Fetch all questions for an exam from Firebase
 */
export const fetchExamQuestions = async (examId: string): Promise<ExamQuestion[]> => {
  try {
    const questionsRef = collection(db, 'questions');
    const q = query(questionsRef, where('examId', '==', examId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as ExamQuestion));
  } catch (error) {
    console.error('Error fetching exam questions:', error);
    throw error;
  }
};

/**
 * Fetch random N questions from an exam
 */
export const fetchRandomExamQuestions = async (
  examId: string,
  count: number = 10
): Promise<ExamQuestion[]> => {
  const allQuestions = await fetchExamQuestions(examId);

  // Shuffle and get random N questions
  const shuffled = allQuestions.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, allQuestions.length));
};

/**
 * Student answers: map of question ID to selected answer
 */
export interface StudentAnswers {
  [questionId: string]: string;
}

/**
 * Auto-correct exam answers
 */
export const autoCorrectExam = (
  questions: ExamQuestion[],
  answers: StudentAnswers
): {
  score: number;
  totalPoints: number;
  percentage: number;
  details: Array<{
    questionId: string;
    correct: boolean;
    earnedPoints: number;
    totalPoints: number;
  }>;
} => {
  let totalScore = 0;
  let totalPoints = 0;
  const details = [];

  for (const question of questions) {
    totalPoints += question.points;
    const studentAnswer = answers[question.id];
    const isCorrect = studentAnswer === question.correctAnswer;

    if (isCorrect) {
      totalScore += question.points;
    }

    details.push({
      questionId: question.id,
      correct: isCorrect,
      earnedPoints: isCorrect ? question.points : 0,
      totalPoints: question.points,
    });
  }

  return {
    score: totalScore,
    totalPoints,
    percentage: totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0,
    details,
  };
};

/**
 * Submit exam results to Firebase
 */
export const submitExamResults = async (
  studentId: string,
  examId: string,
  sessionId: string,
  answers: StudentAnswers,
  questions: ExamQuestion[],
  timeTaken: number, // seconds
  proctoringAlerts: number
) => {
  try {
    const corrections = autoCorrectExam(questions, answers);

    const resultsRef = doc(collection(db, 'exam_results'));
    await setDoc(resultsRef, {
      studentId,
      examId,
      sessionId,
      score: corrections.score,
      totalPoints: corrections.totalPoints,
      percentageScore: corrections.percentage,
      timeTaken,
      submittedAt: serverTimestamp(),
      proctoringAlerts,
      details: corrections.details,
    });

    return {
      resultId: resultsRef.id,
      ...corrections,
    };
  } catch (error) {
    console.error('Error submitting exam results:', error);
    throw error;
  }
};

/**
 * Local storage functions for saving progress
 */

const STORAGE_KEY_PREFIX = 'exam_progress_';

export const saveProgressToLocalStorage = (
  examId: string,
  answers: StudentAnswers,
  currentQuestionIndex: number,
  timeSpent: number
) => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${examId}`;
    const data = {
      answers,
      currentQuestionIndex,
      timeSpent,
      lastSaved: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const loadProgressFromLocalStorage = (
  examId: string
): {
  answers: StudentAnswers;
  currentQuestionIndex: number;
  timeSpent: number;
} | null => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${examId}`;
    const data = localStorage.getItem(key);

    if (!data) return null;

    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return null;
  }
};

export const clearProgressFromLocalStorage = (examId: string) => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${examId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
};

/**
 * AI Feedback Generation for wrong answers
 * Generates a 1-sentence explanation for why the student's answer was wrong
 */
export const generateAIFeedback = async (
  questionText: string,
  studentAnswer: string,
  correctAnswer: string,
  options: Array<{ id: string; text: string }>
): Promise<string> => {
  try {
    // Find the text for student answer and correct answer
    const studentAnswerText = options.find((o) => o.id === studentAnswer)?.text || 'Unknown';
    const correctAnswerText = options.find((o) => o.id === correctAnswer)?.text || 'Unknown';

    // Build the prompt
    const prompt = `Question: "${questionText}"
Student answered: "${studentAnswerText}"
Correct answer: "${correctAnswerText}"

Provide a single sentence explanation of why the correct answer is right. Keep it educational and brief.`;

    // Try to use OpenAI if API key is available
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (apiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 100,
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.choices[0].message.content.trim();
        }
      } catch (error) {
        console.warn('OpenAI API call failed, using fallback:', error);
      }
    }

    // Fallback: Generate simple feedback without AI
    return `The correct answer is "${correctAnswerText}" because it better addresses the question than "${studentAnswerText}".`;
  } catch (error) {
    console.error('Error generating AI feedback:', error);
    return 'This question was answered incorrectly. Please review the concept.';
  }
};

/**
 * Fetch proctoring alerts and history for a session
 */
export const fetchProctoringLog = async (sessionId: string): Promise<any[]> => {
  try {
    const alertsRef = collection(db, 'live_sessions', sessionId, 'alerts');
    const alertsSnapshot = await getDocs(alertsRef);

    return alertsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching proctoring log:', error);
    return [];
  }
};

/**
 * Calculate final result with AI feedback and proctoring log
 * Comprehensive result generation including:
 * - Answer comparison and scoring
 * - AI-generated feedback for wrong answers
 * - Proctoring history and flags
 * - Overall assessment
 */
export interface AIFeedbackItem {
  questionId: string;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  feedback: string;
}

export interface FinalExamResult {
  resultId: string;
  studentId: string;
  examId: string;
  sessionId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  aiFeedback: AIFeedbackItem[];
  proctorLog: any[];
  proctorStatus: 'GREEN' | 'YELLOW' | 'RED';
  submittedAt: Date;
  timeTaken: number;
}

export const calculateFinalResult = async (
  studentId: string,
  examId: string,
  sessionId: string,
  answers: StudentAnswers,
  questions: ExamQuestion[],
  timeTaken: number,
  alertCount: number
): Promise<FinalExamResult> => {
  try {
    // 1. Auto-correct answers
    const corrections = autoCorrectExam(questions, answers);

    // 2. Generate AI feedback for wrong answers
    const aiFeedback: AIFeedbackItem[] = [];

    for (const question of questions) {
      const studentAnswer = answers[question.id];
      const isCorrect = studentAnswer === question.correctAnswer;

      if (!isCorrect) {
        const feedback = await generateAIFeedback(
          question.text,
          studentAnswer || 'No answer',
          question.correctAnswer,
          question.options
        );

        aiFeedback.push({
          questionId: question.id,
          questionText: question.text,
          studentAnswer: studentAnswer || 'No answer',
          correctAnswer: question.correctAnswer,
          feedback,
        });
      }
    }

    // 3. Fetch proctoring log
    const proctorLog = await fetchProctoringLog(sessionId);

    // 4. Determine proctoring status based on alert count and severity
    let proctorStatus: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (alertCount > 5) {
      proctorStatus = 'RED'; // High suspicion
    } else if (alertCount > 2) {
      proctorStatus = 'YELLOW'; // Moderate suspicion
    }

    // 5. Save comprehensive result to Firebase
    const resultsRef = doc(collection(db, 'exam_results'));
    const finalResult: FinalExamResult = {
      resultId: resultsRef.id,
      studentId,
      examId,
      sessionId,
      score: corrections.score,
      totalPoints: corrections.totalPoints,
      percentage: corrections.percentage,
      aiFeedback,
      proctorLog,
      proctorStatus,
      submittedAt: new Date(),
      timeTaken,
    };

    await setDoc(resultsRef, {
      studentId,
      examId,
      sessionId,
      score: corrections.score,
      totalPoints: corrections.totalPoints,
      percentageScore: corrections.percentage,
      timeTaken,
      submittedAt: serverTimestamp(),
      proctoringAlerts: alertCount,
      proctorStatus,
      aiFeedback: aiFeedback.map((item) => ({
        questionId: item.questionId,
        questionText: item.questionText,
        studentAnswer: item.studentAnswer,
        correctAnswer: item.correctAnswer,
        feedback: item.feedback,
      })),
      proctorLog: proctorLog.map((log) => ({
        ...log,
        timestamp: log.timestamp?.toDate?.() || new Date(log.timestamp),
      })),
      details: corrections.details,
    });

    return finalResult;
  } catch (error) {
    console.error('Error calculating final result:', error);
    throw error;
  }
};

/**
 * Fetch all available exams for students
 */
export const fetchAvailableExams = async () => {
  try {
    const examsRef = collection(db, 'exams');
    const snapshot = await getDocs(examsRef);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        description: data.description || '',
        duration: `${data.durationMinutes || 60} mins`,
        questions: data.questions || 0,
        totalPoints: data.totalPoints || 0,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        createdBy: data.createdBy || '',
        startAt: data.startAt?.toDate?.() ?? null,
        endAt: data.endAt?.toDate?.() ?? null,
        status: data.status || 'published',
      };
    });
  } catch (error) {
    console.error('Error fetching available exams:', error);
    throw error;
  }
};

/**
 * Fetch completed exams and results for a student
 */
export const fetchStudentResults = async (studentId: string) => {
  try {
    const resultsRef = collection(db, 'exam_results');
    const q = query(resultsRef, where('studentId', '==', studentId));
    const snapshot = await getDocs(q);

    const results = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        examId: data.examId || '',
        score: data.score || 0,
        totalPoints: data.totalPoints || 0,
        percentageScore: data.percentageScore || 0,
        timeTaken: data.timeTaken || 0,
        submittedAt: data.submittedAt?.toDate?.() || new Date(),
        proctorStatus: data.proctorStatus || 'GREEN',
      };
    });

    // Sort by submitted date, most recent first
    return results.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  } catch (error) {
    console.error('Error fetching student results:', error);
    throw error;
  }
};

/**
 * Fetch exam titles by exam IDs (for mapping in results)
 */
export const fetchExamTitles = async (examIds: string[]) => {
  try {
    const titles: { [key: string]: string } = {};

    for (const examId of examIds) {
      const examsRef = collection(db, 'exams');
      const snapshot = await getDocs(examsRef);

      const exam = snapshot.docs.find((d) => d.id === examId);
      if (exam) {
        titles[examId] = exam.data().title || 'Unknown Exam';
      }
    }

    return titles;
  } catch (error) {
    console.error('Error fetching exam titles:', error);
    return {};
  }
};

/**
 * Calculate student statistics
 */
export const fetchStudentStats = async (studentId: string) => {
  try {
    const results = await fetchStudentResults(studentId);

    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const totalPoints = results.reduce((sum, r) => sum + r.totalPoints, 0);
    const averageScore = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
    const completedCount = results.length;

    // Calculate streak (consecutive days with exams)
    const today = new Date();
    let streak = 0;
    let checkDate = new Date(today);

    for (let i = 0; i < 365; i++) {
      const dayExams = results.filter(
        (r) =>
          r.submittedAt.toDateString() === checkDate.toDateString()
      );
      if (dayExams.length > 0) {
        streak++;
      } else {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      averageScore: Math.round(averageScore),
      completedCount,
      streak,
    };
  } catch (error) {
    console.error('Error calculating student stats:', error);
    return {
      averageScore: 0,
      completedCount: 0,
      streak: 0,
    };
  }
};
