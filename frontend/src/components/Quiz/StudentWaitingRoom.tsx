import React, { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import { vocabService } from '../../services/vocabService';
import type { QuizConfig, VocabBook, QuestionType, StudentMode, VocabQuestion } from '../../types/quiz';
import { FieldAwareQuizFormatSelector, getQuestionTypeFromFormat } from './FieldAwareQuizFormatSelector';
import { BookSelector } from './BookSelector';
import { LessonRangeSelector } from './LessonRangeSelector';
import { QuestionCountSelector } from './QuestionCountSelector';
import { colors } from '../../config/colors';
import { LoadingScreen } from '../common/LoadingScreen';

interface StudentWaitingRoomProps {
  onStartQuiz: (studentName: string, config: QuizConfig) => void;
  onJoinRoom: (studentName: string, roomCode: string) => void;
  roomCodeFromUrl?: string;
}

export const StudentWaitingRoom: React.FC<StudentWaitingRoomProps> = ({ onStartQuiz, onJoinRoom, roomCodeFromUrl }) => {
  const [mode, setMode] = useState<StudentMode>('classroom');
  const [studentName, setStudentName] = useState('');
  const [roomCode, setRoomCode] = useState(roomCodeFromUrl || '');
  const [isStarting, setIsStarting] = useState(false);

  // Auto-scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  // Study mode states
  const [books, setBooks] = useState<VocabBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number>(1);
  const [questionCount, setQuestionCount] = useState<string>('10');
  const [lessonStart, setLessonStart] = useState<string>('1');
  const [lessonEnd, setLessonEnd] = useState<string>('5');
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType>('nepali_to_kanji');
  const [quizFormat, setQuizFormat] = useState({
    input1: 'ネパール語',
    input2: undefined as string | undefined,
    output: '漢字'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [vocabularyQuestions, setVocabularyQuestions] = useState<VocabQuestion[]>([]);

  // Set classroom mode when room code is provided from URL
  useEffect(() => {
    if (roomCodeFromUrl) {
      setMode('classroom');
    }
  }, [roomCodeFromUrl]);

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
    if (mode === 'classroom' && !studentName.trim()) {
      return;
    }

    setIsStarting(true);
    try {
      if (mode === 'study') {
        const config: QuizConfig = {
          bookId: selectedBookId,
          bookTitle: books.find(b => b.id === selectedBookId)?.name || '',
          questionCount: parseInt(questionCount) || 10,
          lessonRange: { start: parseInt(lessonStart) || 1, end: parseInt(lessonEnd) || 1 },
          enabledQuestionTypes: [selectedQuestionType],
          quizFormat: quizFormat
        };
        await onStartQuiz('勉強中の学生', config);
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

  // Number change handling is now in shared components

  const { newGoldColor, crimsonColor } = colors;

  if (isLoading) {
    return <LoadingScreen message="教材を読み込み中..." />;
  }


  return (
    <div className="min-h-screen p-2 md:p-4 pt-4 md:pt-8">
      <div className="max-w-2xl w-full mx-auto">
        <div className="bg-white rounded-lg shadow-2xl p-3 md:p-8">
          {/* Header */}
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 md:mb-8" style={{ color: crimsonColor }}>
            {mode === 'study' ? '単語クイズ作成' : '教室テスト参加'}
          </h2>

          {/* Mode Selection */}
          <div className="mb-4 md:mb-8">
            <div className="flex rounded-xl p-1 bg-gray-100">
              <Button
                onClick={() => setMode('classroom')}
                variant={mode === 'classroom' ? 'contained' : 'text'}
                sx={{
                  flex: 1,
                  backgroundColor: mode === 'classroom' ? 'white' : 'transparent',
                  color: mode === 'classroom' ? crimsonColor : '#6B7280',
                  fontSize: '14px',
                  fontWeight: 'medium',
                  textTransform: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  boxShadow: mode === 'classroom' ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: mode === 'classroom' ? 'white' : 'rgba(107, 114, 128, 0.1)',
                  }
                }}
              >
                🏫 教室テスト
              </Button>
              <Button
                onClick={() => setMode('study')}
                variant={mode === 'study' ? 'contained' : 'text'}
                sx={{
                  flex: 1,
                  backgroundColor: mode === 'study' ? 'white' : 'transparent',
                  color: mode === 'study' ? crimsonColor : '#6B7280',
                  fontSize: '14px',
                  fontWeight: 'medium',
                  textTransform: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  boxShadow: mode === 'study' ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: mode === 'study' ? 'white' : 'rgba(107, 114, 128, 0.1)',
                  }
                }}
              >
                📖 勉強モード
              </Button>
            </div>
          </div>

          {/* Input Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-6 gap-y-3 md:gap-y-6">
            {mode === 'classroom' && (
              <>
                <div className="md:col-span-2">
                  <label htmlFor="studentName" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
                    あなたの名前
                  </label>
                  <input
                    id="studentName"
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="早稲田太郎"
                    className="w-full p-3 text-center border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
                    disabled={isStarting}
                  />
                </div>

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
              </>
            )}

            {mode === 'study' && (
              <>
                <BookSelector
                  books={books}
                  selectedBookId={selectedBookId}
                  onBookChange={setSelectedBookId}
                  disabled={isStarting}
                  loading={isLoading}
                />

                <QuestionCountSelector
                  questionCount={questionCount}
                  onQuestionCountChange={() => {}} // Not used in string mode
                  disabled={isStarting}
                  useStringState={true}
                  onStringChange={setQuestionCount}
                />

                <LessonRangeSelector
                  lessonStart={lessonStart}
                  lessonEnd={lessonEnd}
                  onLessonStartChange={() => {}} // Not used in string mode
                  onLessonEndChange={() => {}} // Not used in string mode
                  disabled={isStarting}
                  useStringState={true}
                  onStringChange={(value, type) => {
                    if (type === 'start') {
                      setLessonStart(value);
                    } else {
                      setLessonEnd(value);
                    }
                  }}
                />

                <FieldAwareQuizFormatSelector
                  value={quizFormat}
                  onChange={handleFormatChange}
                  allowMultipleInputs={true}
                  vocabularyQuestions={vocabularyQuestions}
                />
              </>
            )}
          </div>

          <div className="mt-4 md:mt-10 pt-1 md:pt-2">
            <Button
              onClick={handleStart}
              variant="contained"
              disabled={
                isStarting ||
                (mode === 'classroom' && (!studentName.trim() || !roomCode.trim()))
              }
              sx={{
                width: '100%',
                backgroundColor: isStarting ? '#9CA3AF' : newGoldColor,
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                textTransform: 'none',
                borderRadius: '8px',
                padding: '14px 24px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                  backgroundColor: isStarting ? '#9CA3AF' : newGoldColor,
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  transform: 'translateY(-2px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
                '&.Mui-disabled': {
                  backgroundColor: '#9CA3AF',
                  color: 'white',
                  opacity: 0.6,
                }
              }}
            >
              {isStarting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{mode === 'study' ? '開始中...' : '参加中...'}</span>
                </div>
              ) : (
                <span>{mode === 'study' ? 'クイズを開始' : 'ルームに参加'}</span>
              )}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};