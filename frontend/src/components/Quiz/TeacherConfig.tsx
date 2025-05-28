import React, { useState, useEffect } from 'react';
import { type QuizConfig, QuestionType, type VocabBook } from '../../types/quiz';
import { vocabService } from '../../services/vocabService';

interface TeacherConfigProps {
  onConfigSubmit: (config: QuizConfig) => void;
}

export const TeacherConfig: React.FC<TeacherConfigProps> = ({ onConfigSubmit }) => {
  const [books, setBooks] = useState<VocabBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [lessonStart, setLessonStart] = useState<number>(1);
  const [lessonEnd, setLessonEnd] = useState<number>(1);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [enabledQuestionTypes, setEnabledQuestionTypes] = useState<QuestionType[]>([
    QuestionType.NEPALI_TO_KANJI
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const questionCountOptions = [5, 10, 15, 20, 25, 30, 40, 50];

  const questionTypeLabels = {
    [QuestionType.NEPALI_TO_KANJI]: 'ネパール語 → 漢字',
    [QuestionType.NEPALI_TO_RUBI]: 'ネパール語 → 読み',
    [QuestionType.KANJI_TO_RUBI]: '漢字 → 読み',
    [QuestionType.RUBI_TO_KANJI]: '読み → 漢字',
    [QuestionType.KANJI_TO_NEPALI]: '漢字 → ネパール語',
    [QuestionType.RUBI_TO_NEPALI]: '読み → ネパール語',
    [QuestionType.FILL_IN_BLANK]: '空欄補充問題'
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const response = await vocabService.getBooks();
      const booksData = response.books;
      setBooks(booksData);
      if (booksData.length > 0) {
        setSelectedBookId(booksData[0].id);
      }
    } catch (err) {
      setError('教材の読み込みに失敗しました');
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionTypeToggle = (type: QuestionType) => {
    setEnabledQuestionTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBookId) {
      setError('教材を選択してください');
      return;
    }

    if (enabledQuestionTypes.length === 0) {
      setError('少なくとも1つの出題形式を選択してください');
      return;
    }

    if (lessonStart > lessonEnd) {
      setError('開始課は終了課以下である必要があります');
      return;
    }

    const selectedBook = books.find(book => book.id === selectedBookId);
    if (!selectedBook) {
      setError('選択された教材が見つかりません');
      return;
    }

    const config: QuizConfig = {
      bookId: selectedBookId,
      bookTitle: selectedBook.name,
      lessonRange: {
        start: lessonStart,
        end: lessonEnd
      },
      questionCount,
      enabledQuestionTypes,
      difficulty: 'normal'
    };

    onConfigSubmit(config);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">教材を読み込み中...</h2>
          <p className="text-gray-600">しばらくお待ちください</p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">語彙クイズシステム</h1>
          <p className="text-xl text-gray-600">教師用設定画面</p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                クイズ設定
              </h2>
              <p className="text-blue-100 mt-2">生徒用のクイズを作成しましょう</p>
            </div>

            <div className="p-8">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg">
                  <div className="flex">
                    <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-red-800">エラーが発生しました</h3>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* 教材選択 */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="flex items-center mb-4">
                    <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                    <label className="text-lg font-semibold text-gray-800">教材選択</label>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">クイズに使用する語彙ブックを選択してください</p>
                  <select
                    value={selectedBookId || ''}
                    onChange={(e) => setSelectedBookId(Number(e.target.value))}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white text-lg"
                    required
                  >
                    <option value="">📚 教材を選択してください</option>
                    {books.map(book => (
                      <option key={book.id} value={book.id}>
                        {book.name} - {book.level} ({book.question_count}問)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 課の範囲 */}
                <div className="bg-green-50 rounded-xl p-6">
                  <div className="flex items-center mb-4">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    <label className="text-lg font-semibold text-gray-800">課の範囲</label>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">出題範囲となる課番号を指定してください</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">📖 開始課</label>
                      <input
                        type="number"
                        min="1"
                        value={lessonStart}
                        onChange={(e) => setLessonStart(Number(e.target.value))}
                        className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-lg text-center"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">📚 終了課</label>
                      <input
                        type="number"
                        min="1"
                        value={lessonEnd}
                        onChange={(e) => setLessonEnd(Number(e.target.value))}
                        className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-lg text-center"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      課 {lessonStart} ～ 課 {lessonEnd}
                    </span>
                  </div>
                </div>

                {/* 問題数 */}
                <div className="bg-purple-50 rounded-xl p-6">
                  <div className="flex items-center mb-4">
                    <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
                    </svg>
                    <label className="text-lg font-semibold text-gray-800">問題数</label>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">クイズで出題する問題の数を選択してください</p>
                  <div className="grid grid-cols-4 gap-3">
                    {questionCountOptions.map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionCount(count)}
                        className={`p-4 rounded-lg border-2 transition-all text-center font-semibold ${
                          questionCount === count
                            ? 'border-purple-500 bg-purple-500 text-white shadow-lg transform scale-105'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                        }`}
                      >
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs">問</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                      選択中: {questionCount}問
                    </span>
                  </div>
                </div>

                {/* 出題形式 */}
                <div className="bg-orange-50 rounded-xl p-6">
                  <div className="flex items-center mb-4">
                    <svg className="w-5 h-5 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <label className="text-lg font-semibold text-gray-800">出題形式</label>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">使用する問題タイプを選択してください（複数選択可）</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(questionTypeLabels).map(([type, label]) => (
                      <label
                        key={type}
                        className={`relative flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          enabledQuestionTypes.includes(type as QuestionType)
                            ? 'border-orange-500 bg-orange-100 text-orange-900'
                            : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enabledQuestionTypes.includes(type as QuestionType)}
                          onChange={() => handleQuestionTypeToggle(type as QuestionType)}
                          className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded mr-4"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-sm">{label}</span>
                        </div>
                        {enabledQuestionTypes.includes(type as QuestionType) && (
                          <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                      選択中: {enabledQuestionTypes.length}種類
                    </span>
                  </div>
                </div>

                {/* 送信ボタン */}
                <div className="pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg text-lg"
                  >
                    <span className="flex items-center justify-center">
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      🚀 クイズを開始する
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};