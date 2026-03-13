import { useState } from 'react';
import type { ExamQuestion } from '../types/exam';
import { generateQuestionsFromText } from '../services/aiService';

interface AIGeneratorProps {
  onQuestionsGenerated: (questions: ExamQuestion[]) => void;
}

export function AIQuestionGenerator({ onQuestionsGenerated }: AIGeneratorProps) {
  const [rawText, setRawText] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!rawText.trim()) {
      setError('Please enter some text to generate questions from');
      return;
    }

    if (rawText.trim().length < 100) {
      setError('Please provide at least 100 characters of text');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const aiQuestions = await generateQuestionsFromText(rawText, numberOfQuestions);

      // Convert AI questions to ExamQuestion format
      const formattedQuestions: ExamQuestion[] = aiQuestions.map((aq, index) => ({
        id: `ai-q-${Date.now()}-${index}`,
        text: aq.question,
        options: aq.options.map((opt, optIndex) => ({
          id: `opt-${optIndex}`,
          text: opt,
        })),
        correctAnswer: `opt-${aq.correctAnswer}`,
        points: aq.points,
      }));

      onQuestionsGenerated(formattedQuestions);
      setRawText('');
      setNumberOfQuestions(5);
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg shadow-md border border-blue-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-lg">✨</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">AI Question Generator</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Paste a paragraph of text and let AI generate multiple-choice questions automatically.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="rawText" className="block text-sm font-medium text-gray-700 mb-2">
          Paste Your Text *
        </label>
        <textarea
          id="rawText"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={6}
          placeholder="Paste a paragraph of text here. AI will generate multiple-choice questions from it..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500">
          {rawText.length} characters ({Math.ceil(rawText.length / 5)} words)
        </p>
      </div>

      <div className="mb-4">
        <label htmlFor="numQuestions" className="block text-sm font-medium text-gray-700 mb-2">
          Number of Questions to Generate
        </label>
        <select
          id="numQuestions"
          value={numberOfQuestions}
          onChange={(e) => setNumberOfQuestions(parseInt(e.target.value))}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <option key={n} value={n}>{n} questions</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block animate-spin">⚙️</span>
            Generating Questions...
          </>
        ) : (
          <>
            <span>✨</span>
            Generate Questions with AI
          </>
        )}
      </button>

      <p className="mt-3 text-xs text-gray-500">
        💡 Tip: Provide 200+ characters for better quality questions
      </p>
    </div>
  );
}
