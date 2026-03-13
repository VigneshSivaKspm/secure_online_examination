// Mock AI service for generating questions
// In production, replace with actual OpenAI API call

export interface AIQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option
  points: number;
}

export async function generateQuestionsFromText(
  text: string,
  numberOfQuestions: number = 5
): Promise<AIQuestion[]> {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock implementation - extracts key sentences and creates questions
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    if (sentences.length === 0) {
      throw new Error('Text too short to generate questions');
    }

    const questions: AIQuestion[] = [];
    const questionsToGenerate = Math.min(numberOfQuestions, sentences.length);

    for (let i = 0; i < questionsToGenerate; i++) {
      const sentence = sentences[i].trim();
      const words = sentence.split(' ');
      
      // Create a question by removing a key phrase
      const keywordIndex = Math.floor(Math.random() * (words.length - 2)) + 1;
      const keyword = words[keywordIndex];
      const questionText = sentence.replace(
        keyword,
        `________ (${keyword}?)`
      );

      // Generate distractors
      const commonWords = ['process', 'method', 'system', 'technology', 'concept', 'principle'];
      const distractors = commonWords
        .filter(w => w !== keyword.toLowerCase())
        .slice(0, 3);

      const allOptions = [keyword, ...distractors].sort(() => Math.random() - 0.5);
      const correctAnswerIndex = allOptions.indexOf(keyword);

      questions.push({
        question: `Based on the text, what completes this statement: "${questionText}"?`,
        options: allOptions,
        correctAnswer: correctAnswerIndex,
        points: 5,
      });
    }

    return questions;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new Error('Failed to generate questions. Please try again.');
  }
}

// Real OpenAI integration (commented out - uncomment and use with API key)
/*
import axios from 'axios';

export async function generateQuestionsFromTextWithOpenAI(
  text: string,
  numberOfQuestions: number = 5
): Promise<AIQuestion[]> {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating multiple-choice questions.'
          },
          {
            role: 'user',
            content: `Generate exactly ${numberOfQuestions} multiple-choice questions from this text:\n\n${text}\n\nReturn ONLY a valid JSON array with this structure: [{"question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": 0, "points": 5}]`
          }
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const content = response.data.choices[0].message.content;
    const questions = JSON.parse(content);
    return questions;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw new Error('Failed to generate questions using AI');
  }
}
*/
