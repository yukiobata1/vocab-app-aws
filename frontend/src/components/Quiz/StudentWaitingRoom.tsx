import React, { useState, useEffect } from 'react';
import { vocabService } from '../../services/vocabService';
import type { QuizConfig, VocabBook, QuestionType, StudentMode, VocabQuestion } from '../../types/quiz';
import { FieldAwareQuizFormatSelector, getQuestionTypeFromFormat } from './FieldAwareQuizFormatSelector';
import { colors } from '../../config/colors';

interface StudentWaitingRoomProps {
  onStartQuiz: (studentName: string, config: QuizConfig) => void;
  onJoinRoom: (studentName: string, roomCode: string) => void;
}

export const StudentWaitingRoom: React.FC<StudentWaitingRoomProps> = ({ onStartQuiz, onJoinRoom }) => {
  const [mode, setMode] = useState<StudentMode>('classroom');
  const [studentName, setStudentName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  
  // Study mode states
  const [books, setBooks] = useState<VocabBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number>(1);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [lessonStart, setLessonStart] = useState<number>(1);
  const [lessonEnd, setLessonEnd] = useState<number>(5);
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType>('nepali_to_kanji');
  const [quizFormat, setQuizFormat] = useState({
    input1: 'ネパール語',
    input2: undefined as string | undefined,
    output: '漢字'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [vocabularyQuestions, setVocabularyQuestions] = useState<VocabQuestion[]>([]);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        const response = await vocabService.getBooks();
        const booksData = response.books.filter(book => book.question_count > 4);
        setBooks(booksData);
        if (booksData.length > 0) {
          setSelectedBookId(booksData[0].id);
        }
      } catch (error) {
        console.error('Failed to load books:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadBooks();
  }, []);

  useEffect(() => {
    if (selectedBookId && books.length > 0) {
      loadVocabularyQuestions(selectedBookId);
    }
  }, [selectedBookId, books]);

  const loadVocabularyQuestions = async (bookId: number) => {
    try {
      // Load a sample of questions to analyze field availability
      const response = await vocabService.getQuestions(bookId, 20, 0);
      setVocabularyQuestions(response.questions);
    } catch (err) {
      console.error('Failed to load vocabulary questions for field analysis:', err);
      // Don't show error to user as this is for field detection only
      setVocabularyQuestions([]);
    }
  };

  const handleStart = async () => {
    if (!studentName.trim()) {
      return;
    }

    setIsStarting(true);
    try {
      if (mode === 'study') {
        const config: QuizConfig = {
          bookId: selectedBookId,
          bookTitle: books.find(b => b.id === selectedBookId)?.name || '',
          questionCount,
          lessonRange: { start: lessonStart, end: lessonEnd },
          enabledQuestionTypes: [selectedQuestionType],
          quizFormat: quizFormat
        };
        await onStartQuiz(studentName.trim(), config);
      } else {
        // Classroom mode
        if (!roomCode.trim()) {
          setIsStarting(false);
          return;
        }
        await onJoinRoom(studentName.trim(), roomCode.trim().toUpperCase());
      }
    } catch (error) {
      console.error('Failed to start:', error);
      setIsStarting(false);
    }
  };

  const handleFormatChange = (format: { input1: string; input2: string | undefined; output: string }) => {
    setQuizFormat(format);
    setSelectedQuestionType(getQuestionTypeFromFormat(format.input1, format.output, format.input2));
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setRoomCode(value);
    }
  };

  const { newGoldColor, crimsonColor } = colors;

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex flex-col justify-center items-center p-4 text-center">
      <div 
        className="animate-spin rounded-full h-12 w-12 border-b-4 mb-4"
        style={{ borderColor: newGoldColor }}
      ></div>
      <p className="text-xl font-medium" style={{ color: crimsonColor }}>教材を読み込み中...</p>
      <p className="text-gray-500">しばらくお待ちください。</p>
    </div>
    );
  }


  return (
    <div className="min-h-screen p-4 pt-8">
      <div className="max-w-2xl w-full mx-auto">
        <div className="bg-white rounded-lg shadow-2xl p-6 md:p-8">
          {/* Header */}
          <h2 className="text-3xl font-bold text-center mb-8" style={{ color: crimsonColor }}>
            {mode === 'study' ? '単語クイズ設定' : '教室テスト参加'}
          </h2>

          {/* Mode Selection */}
          <div className="mb-6">
            <div className="flex rounded-xl p-1 bg-gray-100">
              <button
                onClick={() => setMode('classroom')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === 'classroom'
                    ? 'shadow-sm'
                    : ''
                }`}
                style={{
                  backgroundColor: mode === 'classroom' ? 'white' : 'transparent',
                  color: mode === 'classroom' ? crimsonColor : '#6B7280'
                }}
              >
                🏫 教室テスト
              </button>
              <button
                onClick={() => setMode('study')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === 'study'
                    ? 'shadow-sm'
                    : ''
                }`}
                style={{
                  backgroundColor: mode === 'study' ? 'white' : 'transparent',
                  color: mode === 'study' ? crimsonColor : '#6B7280'
                }}
              >
                📖 勉強モード
              </button>
            </div>
          </div>

          {/* Input Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            <div className="md:col-span-2">
              <label htmlFor="studentName" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
                あなたの名前
              </label>
              <input
                id="studentName"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="山田太郎"
                className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
                disabled={isStarting}
              />
            </div>

            {mode === 'classroom' && (
              <div className="md:col-span-2">
                <label htmlFor="roomCode" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
                  クイズコード
                </label>
                <input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={handleRoomCodeChange}
                  placeholder="ABC123"
                  className="w-full p-3 text-center font-mono border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500 tracking-wider"
                  disabled={isStarting}
                  style={{ fontSize: '1.25rem' }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  先生から教えてもらった6文字のコードを入力してください
                </p>
              </div>
            )}

            {mode === 'study' && (
              <>
                <div className="md:col-span-2">
                  <label htmlFor="bookSelect" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
                    教材選択
                  </label>
                  <select
                    id="bookSelect"
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
                    disabled={isStarting}
                  >
                    {books.map(book => (
                      <option key={book.id} value={book.id}>{book.name}</option>
                    ))}
                  </select>
                </div>


                <div>
                  <label htmlFor="lessonStart" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
                    開始課
                  </label>
                  <input
                    id="lessonStart"
                    type="number"
                    min={1}
                    max={50}
                    value={lessonStart}
                    onChange={(e) => setLessonStart(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
                    disabled={isStarting}
                  />
                </div>
                <div>
                  <label htmlFor="lessonEnd" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
                    終了課
                  </label>
                  <input
                    id="lessonEnd"
                    type="number"
                    min={lessonStart}
                    max={50}
                    value={lessonEnd}
                    onChange={(e) => setLessonEnd(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
                    disabled={isStarting}
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="questionCount" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
                    出題数
                  </label>
                  <select
                    id="questionCount"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
                    disabled={isStarting}
                  >
                    <option value={5}>5問</option>
                    <option value={10}>10問</option>
                    <option value={15}>15問</option>
                    <option value={20}>20問</option>
                  </select>
                </div>

                <FieldAwareQuizFormatSelector
                  value={quizFormat}
                  onChange={handleFormatChange}
                  allowMultipleInputs={true}
                  vocabularyQuestions={vocabularyQuestions}
                />
              </>
            )}
          </div>

          <div className="mt-10 pt-2">
            <button
              onClick={handleStart}
              disabled={
                !studentName.trim() || 
                isStarting ||
                  (mode === 'classroom' && !roomCode.trim())
              }
              className="w-full text-white py-3.5 px-6 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-700 transition-all duration-150 ease-in-out shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: isStarting ? '#9CA3AF' : newGoldColor }}
            >
              {isStarting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{mode === 'study' ? '開始中...' : '参加中...'}</span>
                </div>
              ) : (
                <span>{mode === 'study' ? 'クイズを開始' : 'ルームに参加'}</span>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};