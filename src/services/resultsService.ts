import { collection, getDocs, query, where, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { StudentResult } from '../types/exam';

export async function fetchResultsFromFirebase(examId: string): Promise<StudentResult[]> {
  try {
    const resultsRef = collection(db, 'results');
    const q = query(resultsRef, where('examId', '==', examId));
    const querySnapshot = await getDocs(q);

    const results: StudentResult[] = [];
    querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        studentId: data.studentId,
        studentName: data.studentName || 'Unknown',
        examId: data.examId,
        score: data.score || 0,
        totalPoints: data.totalPoints || 0,
        percentageScore: data.percentageScore || 0,
        timeTaken: data.timeTaken || 0,
        submittedAt: data.submittedAt?.toDate() || new Date(),
        proctorFlag: data.proctorFlag || 'green',
      });
    });

    return results.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  } catch (error) {
    console.error('Error fetching results:', error);
    throw new Error('Failed to fetch results');
  }
}

// Generate mock results for demo purposes - REMOVED
export function generateMockResults(): StudentResult[] {
  // Mock data removed - now returns empty array
  return [];
}
