// Question types
export interface QuestionOption {
  id: string;
  text: string;
}

export interface ExamQuestion {
  id: string;
  text: string;
  options: QuestionOption[];
  correctAnswer: string; // id of the correct option
  points: number;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  questions: ExamQuestion[];
  totalPoints: number;
  createdAt: Date;
  createdBy: string;
}

// Results types
export interface StudentResult {
  id: string;
  studentId: string;
  studentName: string;
  examId: string;
  score: number;
  totalPoints: number;
  percentageScore: number;
  timeTaken: number; // in seconds
  submittedAt: Date;
  proctorFlag: 'green' | 'red' | 'yellow';
}

export interface ProctoringData {
  studentId: string;
  examId: string;
  tabSwitches: number;
  windowBlurs: number;
  suspiciousActivities: string[];
  flaggedAt?: Date;
}
