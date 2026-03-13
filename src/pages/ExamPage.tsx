import React from 'react';
import { useParams } from 'react-router-dom';
import { ExamRoom } from '../components/ExamRoom';

/**
 * ExamPage - Wrapper for ExamRoom that extracts examId from URL params
 */
export const ExamPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();

  if (!examId) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">Error: Exam ID not found</p>
          <p className="text-gray-600 mt-2">Please navigate from your dashboard</p>
        </div>
      </div>
    );
  }

  return <ExamRoom examId={examId} />;
};

export default ExamPage;
