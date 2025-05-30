import React, { useState } from 'react';
import { StudentWaitingRoom } from './StudentWaitingRoom';
import { StudentQuiz } from './StudentQuiz';
import { StudentResult } from './StudentResult';
import { generateQuiz } from '../../utils/quizGenerator';
import { vocabService } from '../../services/vocabService';
import { roomCodeService } from '../../services/roomCodeService';
import type { QuizConfig, StudentMode } from '../../types/quiz';

interface QuizData {
  question: string;
  options: string[];
  correctAnswer: string;
}

type StudentState = 'waiting' | 'loading' | 'quiz' | 'result' | 'error';

export const StudentContainer: React.FC = () => {
  const [state, setState] = useState<StudentState>('waiting');
  const [studentName, setStudentName] = useState('');
  const [mode, setMode] = useState<StudentMode>('study');
  const [, setRoomCode] = useState('');
  const [quizData, setQuizData] = useState<QuizData[]>([]);
  const [originalQuizData, setOriginalQuizData] = useState<QuizData[]>([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Utility function to shuffle array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Shuffle answer options while keeping correct answer
  const shuffleQuizData = (data: QuizData[]): QuizData[] => {
    const shuffledQuestions = shuffleArray(data);
    return shuffledQuestions.map(question => ({
      ...question,
      options: shuffleArray(question.options)
    }));
  };

  // Study mode: generate quiz from config
  const handleStartQuiz = async (name: string, config: QuizConfig) => {
    setState('loading');
    setStudentName(name);
    setMode('study');
    setError(null);

    try {
      // Fetch questions from API based on config
      const response = await vocabService.getQuestions(config.bookId);
      
      if (!response.questions) {
        throw new Error('APIレスポンスに問題データがありません');
      }
      
      const filteredQuestions = response.questions.filter(
        q => q.ka >= config.lessonRange.start && q.ka <= config.lessonRange.end
      );

      if (filteredQuestions.length === 0) {
        throw new Error('指定された範囲に問題が見つかりませんでした');
      }

      // Generate quiz using the configuration
      const generatedQuiz = generateQuiz(filteredQuestions, config);
      
      // Convert quiz to the format expected by StudentQuiz
      const convertedQuizData = generatedQuiz.questions.map(question => ({
        question: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer
      }));

      setOriginalQuizData(convertedQuizData);
      setQuizData(convertedQuizData);
      setTotalQuestions(convertedQuizData.length);
      setState('quiz');
    } catch (err) {
      console.error('Failed to start quiz:', err);
      setError(err instanceof Error ? err.message : 'クイズの開始に失敗しました');
      setState('error');
      throw err;
    }
  };

  // Classroom mode: join room with room code
  const handleJoinRoom = async (name: string, code: string) => {
    setState('loading');
    setStudentName(name);
    setRoomCode(code);
    setMode('classroom');
    setError(null);

    try {
      // Get room data from DynamoDB
      const roomResponse = await roomCodeService.getRoom(code);
      const room = roomResponse.room;

      // Join the room
      await roomCodeService.joinRoom(code, name);

      // Use the pre-generated questions from the room
      const convertedQuizData = room.questions.map(question => ({
        question: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer
      }));

      setOriginalQuizData(convertedQuizData);
      setQuizData(convertedQuizData);
      setTotalQuestions(convertedQuizData.length);
      setState('quiz');
    } catch (err) {
      console.error('Failed to join room:', err);
      setError(err instanceof Error ? err.message : 'ルームへの参加に失敗しました');
      setState('error');
      throw err;
    }
  };

  const handleQuizComplete = (score: number, total: number) => {
    setCurrentScore(score);
    setTotalQuestions(total);
    setState('result');
  };

  const handleRestart = () => {
    // Restart with shuffled questions and answer choices for better learning
    setCurrentScore(0);
    setQuizData(shuffleQuizData(originalQuizData));
    setState('quiz');
    setError(null);
  };

  const renderContent = () => {
    switch (state) {
      case 'waiting':
        return <StudentWaitingRoom onStartQuiz={handleStartQuiz} onJoinRoom={handleJoinRoom} />;

      case 'loading':
        return (
          <div className="min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-6"></div>
              <div className="text-2xl font-medium text-gray-700 mb-2">
                {mode === 'study' ? 'クイズを準備中...' : 'ルームに参加中...'}
              </div>
              <div className="text-gray-500">
                {mode === 'study' ? '問題を生成しています' : 'DynamoDBから問題を取得しています'}
              </div>
            </div>
          </div>
        );

      case 'quiz':
        return (
          <StudentQuiz
            quizData={quizData}
            onQuizComplete={handleQuizComplete}
          />
        );

      case 'result':
        return (
          <StudentResult
            score={currentScore}
            totalQuestions={totalQuestions}
            studentName={studentName}
            onRestart={handleRestart}
          />
        );

      case 'error':
        return (
          <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-red-50 flex items-center justify-center p-4">
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">エラーが発生しました</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => {
                    setState('waiting');
                    setError(null);
                    setStudentName('');
                    setMode('study');
                    setRoomCode('');
                  }}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-200 transform hover:scale-105"
                >
                  最初に戻る
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return renderContent();
};