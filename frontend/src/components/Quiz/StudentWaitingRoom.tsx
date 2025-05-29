import React, { useState, useEffect } from 'react';
import { vocabService } from '../../services/vocabService';
import type { QuizConfig, VocabBook, QuestionType, StudentMode } from '../../types/quiz';
import { QUESTION_TYPE_CONFIGS } from '../../types/quiz';

interface StudentWaitingRoomProps {
  onStartQuiz: (studentName: string, config: QuizConfig) => void;
  onJoinRoom: (studentName: string, roomCode: string) => void;
}

export const StudentWaitingRoom: React.FC<StudentWaitingRoomProps> = ({ onStartQuiz, onJoinRoom }) => {
  const [mode, setMode] = useState<StudentMode>('study');
  const [studentName, setStudentName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  
  // Study mode states
  const [books, setBooks] = useState<VocabBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number>(1);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [lessonStart, setLessonStart] = useState<number>(1);
  const [lessonEnd, setLessonEnd] = useState<number>(5);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuestionType[]>(['nepali_to_kanji', 'kanji_to_nepali']);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        const response = await vocabService.getBooks();
        setBooks(response.books);
      } catch (error) {
        console.error('Failed to load books:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadBooks();
  }, []);

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
          enabledQuestionTypes: selectedQuestionTypes
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

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setRoomCode(value);
    }
  };

  const handleQuestionTypeToggle = (type: QuestionType) => {
    setSelectedQuestionTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-6"></div>
          <div className="text-xl text-gray-700">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {/* Logo/Icon */}
          <div className="mb-8">
            <div className="text-8xl mb-4">📚</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              語彙クイズ
            </h1>
            <p className="text-gray-600">
              {mode === 'study' ? 'クイズを設定して開始しましょう！' : '教室テストに参加しましょう！'}
            </p>
          </div>

          {/* Mode Selection */}
          <div className="mb-6">
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setMode('study')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === 'study'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📖 勉強モード
              </button>
              <button
                onClick={() => setMode('classroom')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === 'classroom'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                🏫 教室テスト
              </button>
            </div>
          </div>

          {/* Input Form */}
          <div className="space-y-6">
            <div>
              <label htmlFor="studentName" className="block text-left text-sm font-medium text-gray-700 mb-2">
                あなたの名前
              </label>
              <input
                id="studentName"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="山田太郎"
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                disabled={isStarting}
              />
            </div>

            {mode === 'classroom' && (
              <div>
                <label htmlFor="roomCode" className="block text-left text-sm font-medium text-gray-700 mb-2">
                  クイズコード
                </label>
                <input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={handleRoomCodeChange}
                  placeholder="ABC123"
                  className="w-full px-4 py-3 text-lg text-center font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 tracking-wider"
                  disabled={isStarting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  先生から教えてもらった6文字のコードを入力してください
                </p>
              </div>
            )}

            {mode === 'study' && (
              <>
                <div>
                  <label htmlFor="bookSelect" className="block text-left text-sm font-medium text-gray-700 mb-2">
                    教材を選択
                  </label>
                  <select
                    id="bookSelect"
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(Number(e.target.value))}
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                    disabled={isStarting}
                  >
                    {books.map(book => (
                      <option key={book.id} value={book.id}>{book.name}</option>
                    ))}
                  </select>
                </div>

            <div>
              <label htmlFor="bookSelect" className="block text-left text-sm font-medium text-gray-700 mb-2">
                教材を選択
              </label>
              <select
                id="bookSelect"
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(Number(e.target.value))}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                disabled={isStarting}
              >
                {books.map(book => (
                  <option key={book.id} value={book.id}>{book.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="lessonStart" className="block text-left text-sm font-medium text-gray-700 mb-2">
                  開始課
                </label>
                <input
                  id="lessonStart"
                  type="number"
                  min={1}
                  max={50}
                  value={lessonStart}
                  onChange={(e) => setLessonStart(Number(e.target.value))}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                  disabled={isStarting}
                />
              </div>
              <div>
                <label htmlFor="lessonEnd" className="block text-left text-sm font-medium text-gray-700 mb-2">
                  終了課
                </label>
                <input
                  id="lessonEnd"
                  type="number"
                  min={lessonStart}
                  max={50}
                  value={lessonEnd}
                  onChange={(e) => setLessonEnd(Number(e.target.value))}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                  disabled={isStarting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="questionCount" className="block text-left text-sm font-medium text-gray-700 mb-2">
                問題数
              </label>
              <select
                id="questionCount"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                disabled={isStarting}
              >
                <option value={5}>5問</option>
                <option value={10}>10問</option>
                <option value={15}>15問</option>
                <option value={20}>20問</option>
              </select>
            </div>

            <div>
              <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                出題形式
              </label>
              <div className="space-y-2">
                {Object.values(QUESTION_TYPE_CONFIGS).filter(config => config.enabled).map(config => (
                  <label key={config.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedQuestionTypes.includes(config.id)}
                      onChange={() => handleQuestionTypeToggle(config.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={isStarting}
                    />
                    <span className="text-sm text-gray-700">{config.name}</span>
                  </label>
                ))}
              </div>
            </div>
              </>
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={
              !studentName.trim() || 
              isStarting ||
              (mode === 'study' && selectedQuestionTypes.length === 0) ||
              (mode === 'classroom' && !roomCode.trim())
            }
            className="w-full mt-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
          >
            {isStarting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{mode === 'study' ? '開始中...' : '参加中...'}</span>
              </div>
            ) : (
              <span className="flex items-center justify-center space-x-2">
                <span>🚀</span>
                <span>{mode === 'study' ? 'クイズを開始する' : 'ルームに参加する'}</span>
              </span>
            )}
          </button>

          {/* Help Text */}
          <div className="mt-6 text-sm text-gray-500">
            <p>
              {mode === 'study' 
                ? '設定を確認してクイズを開始してください' 
                : '先生から教えてもらったコードを入力してください'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};