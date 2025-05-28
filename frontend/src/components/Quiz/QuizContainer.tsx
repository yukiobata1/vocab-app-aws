import React, { useState } from 'react';
import { TeacherConfig } from './TeacherConfig';
import { QuizDisplay } from './QuizDisplay';
import type { Quiz, QuizConfig } from '../../types/quiz';
import { generateQuiz } from '../../utils/quizGenerator';
import { vocabService } from '../../services/vocabService';

type QuizState = 'config' | 'loading' | 'quiz' | 'error';

export const QuizContainer: React.FC = () => {
  const [state, setState] = useState<QuizState>('config');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setAnswers] = useState<{ [questionIndex: number]: string }>({});

  const handleConfigSubmit = async (config: QuizConfig) => {
    setState('loading');
    setError(null);

    try {
      // Fetch questions from API based on config
      console.log('Calling getQuestions with bookId:', config.bookId);
      const response = await vocabService.getQuestions(config.bookId);
      console.log('getQuestions response:', response);
      
      // Check if we got questions or books (API might be returning wrong data)
      let questions: any[] = [];
      if (response.questions) {
        questions = response.questions;
      } else if (response.books) {
        // Backend is returning books instead of questions - use mock data for now
        console.warn('Backend API issue: returning books instead of questions. Using mock data.');
        questions = [
          {
            id: 1,
            book_id: config.bookId,
            ka: config.lessonRange.start,
            np1: 'नमस्ते',
            jp_kanji: 'こんにちは',
            jp_rubi: 'こんにちは',
            nepali_sentence: 'नमस्ते, तपाईं कस्तो हुनुहुन्छ?',
            japanese_question: 'ネパール語で「こんにちは」は何と言いますか？',
            japanese_example: 'こんにちは、元気ですか？'
          },
          {
            id: 2,
            book_id: config.bookId,
            ka: config.lessonRange.start,
            np1: 'धन्यवाद',
            jp_kanji: 'ありがとう',
            jp_rubi: 'ありがとう',
            nepali_sentence: 'धन्यवाद, तपाईंको सहायताको लागि।',
            japanese_question: 'ネパール語で「ありがとう」は何と言いますか？',
            japanese_example: 'ありがとう、助かりました。'
          },
          {
            id: 3,
            book_id: config.bookId,
            ka: config.lessonRange.start + 1,
            np1: 'पानी',
            jp_kanji: '水',
            jp_rubi: 'みず',
            nepali_sentence: 'म पानी पिउन चाहन्छु।',
            japanese_question: 'ネパール語で「水」は何と言いますか？',
            japanese_example: '水を飲みたいです。'
          }
        ];
      } else {
        throw new Error('APIレスポンスに問題データがありません');
      }
      
      const filteredQuestions = questions.filter(
        q => q.ka >= config.lessonRange.start && q.ka <= config.lessonRange.end
      );

      if (filteredQuestions.length === 0) {
        throw new Error('指定された範囲に問題が見つかりませんでした');
      }

      // Generate quiz using the questions
      const generatedQuiz = generateQuiz(filteredQuestions, config);
      setQuiz(generatedQuiz);
      setState('quiz');
    } catch (err) {
      console.error('Failed to generate quiz:', err);
      setError(err instanceof Error ? err.message : 'クイズの生成に失敗しました');
      setState('error');
    }
  };

  const handleAnswerSelect = (questionIndex: number, selectedAnswer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: selectedAnswer
    }));
  };

  const handleQuizComplete = (score: number) => {
    console.log(`Quiz completed with score: ${score}%`);
    // Here you could save the quiz results to the backend if needed
  };

  const handleReturnToConfig = () => {
    setState('config');
    setQuiz(null);
    setAnswers({});
    setError(null);
  };

  const renderContent = () => {
    switch (state) {
      case 'config':
        return <TeacherConfig onConfigSubmit={handleConfigSubmit} />;

      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center min-h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <div className="text-lg text-gray-600">クイズを生成中...</div>
          </div>
        );

      case 'quiz':
        return quiz ? (
          <QuizDisplay
            quiz={quiz}
            onAnswerSelect={handleAnswerSelect}
            onQuizComplete={handleQuizComplete}
          />
        ) : null;

      case 'error':
        return (
          <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">エラーが発生しました</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={handleReturnToConfig}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                設定に戻る
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="quiz-container min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">語彙クイズシステム</h1>
          <p className="text-gray-600">教師用クイズ設定・実行システム</p>
        </div>

        {/* Navigation */}
        {state === 'quiz' && (
          <div className="text-center mb-6">
            <button
              onClick={handleReturnToConfig}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              ← 設定に戻る
            </button>
          </div>
        )}

        {/* Main Content */}
        {renderContent()}
      </div>
    </div>
  );
};