import React, { useState } from 'react';
import type { ExamQuestion, QuestionOption } from '../types/exam';

interface QuestionFormProps {
  onAddQuestion: (question: ExamQuestion) => void;
}

export function QuestionForm({ onAddQuestion }: QuestionFormProps) {
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(0);
  const [points, setPoints] = useState(5);
  const [errors, setErrors] = useState<string[]>([]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!questionText.trim()) {
      newErrors.push('Question text is required');
    }

    if (options.some(opt => !opt.trim())) {
      newErrors.push('All options must be filled');
    }

    if (new Set(options).size !== options.length) {
      newErrors.push('Options must be unique');
    }

    if (points <= 0 || points > 100) {
      newErrors.push('Points must be between 1 and 100');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const questionOptions: QuestionOption[] = options.map((text, index) => ({
      id: `opt-${index}`,
      text,
    }));

    const newQuestion: ExamQuestion = {
      id: `q-${Date.now()}`,
      text: questionText,
      options: questionOptions,
      correctAnswer: `opt-${correctAnswerIndex}`,
      points,
    };

    onAddQuestion(newQuestion);

    // Reset form
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectAnswerIndex(0);
    setPoints(5);
    setErrors([]);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Add Question Manually</h3>

      {errors.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          {errors.map((error, idx) => (
            <p key={idx} className="text-sm text-red-700">
              • {error}
            </p>
          ))}
        </div>
      )}

      <div className="mb-6">
        <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
          Question Text *
        </label>
        <textarea
          id="question"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Enter your question here..."
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Options * (Select the correct answer)
        </label>
        <div className="space-y-3">
          {options.map((option, index) => (
            <div key={index} className="flex gap-3">
              <input
                type="radio"
                name="correctAnswer"
                value={index}
                checked={correctAnswerIndex === index}
                onChange={() => setCorrectAnswerIndex(index)}
                className="mt-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="points" className="block text-sm font-medium text-gray-700 mb-2">
          Points *
        </label>
        <input
          id="points"
          type="number"
          min="1"
          max="100"
          value={points}
          onChange={(e) => setPoints(parseInt(e.target.value) || 5)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
      >
        Add Question
      </button>
    </form>
  );
}
