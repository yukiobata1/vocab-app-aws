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
        <div className="text-center bg-white rounded-3xl shadow-2xl p-12">
          <div className="mb-8">
            <div className="text-6xl mb-4">📚</div>
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-pulse">
              {/* <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
              </svg> */}
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">教材を読み込み中...</h2>
          <p className="text-gray-600 mb-6">しばらくお待ちください</p>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-6">
            <div className="text-6xl mb-4">🎯</div>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl mb-6 shadow-xl">
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-800 mb-4">語彙クイズシステム</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            生徒の学習レベルに合わせたカスタマイズ可能な語彙クイズを作成しましょう
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-8 rounded-t-2xl">
              <h2 className="text-3xl font-bold text-white flex items-center">
                <span className="text-2xl mr-3">⚙️</span>
                クイズ設定
              </h2>
              <p className="text-blue-100 mt-3 text-lg">理想的な学習体験を提供するクイズを設計しましょう</p>
            </div>

            <div className="p-8">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg">
                  <div className="flex">
                    {/* <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                    </svg> */}
                    <div>
                      <h3 className="text-sm font-medium text-red-800">エラーが発生しました</h3>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* 教材選択 */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-white text-xl">📚</span>
                    </div>
                    <div>
                      <label className="text-xl font-bold text-gray-800">教材選択</label>
                      <p className="text-blue-600 text-sm font-medium">Step 1</p>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-6">クイズに使用する語彙ブックを選択してください</p>
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
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-white text-xl">📖</span>
                    </div>
                    <div>
                      <label className="text-xl font-bold text-gray-800">課の範囲</label>
                      <p className="text-green-600 text-sm font-medium">Step 2</p>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-6">出題範囲となる課番号を指定してください</p>
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
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-8 border border-purple-100">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-white text-xl">🔢</span>
                    </div>
                    <div>
                      <label className="text-xl font-bold text-gray-800">問題数</label>
                      <p className="text-purple-600 text-sm font-medium">Step 3</p>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-6">クイズで出題する問題の数を選択してください</p>
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
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 border border-orange-100">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-white text-xl">🎲</span>
                    </div>
                    <div>
                      <label className="text-xl font-bold text-gray-800">出題形式</label>
                      <p className="text-orange-600 text-sm font-medium">Step 4</p>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-8">使用する問題タイプを選択してください（複数選択可）</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(questionTypeLabels).map(([type, label]) => {
                      const isSelected = enabledQuestionTypes.includes(type as QuestionType);
                      return (
                        <div
                          key={type}
                          onClick={() => handleQuestionTypeToggle(type as QuestionType)}
                          className={`relative p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                            isSelected
                              ? 'border-orange-500 bg-gradient-to-r from-orange-100 to-red-100 shadow-lg'
                              : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50 shadow-md'
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            {/* Custom Checkbox */}
                            <div className={`relative w-6 h-6 rounded-lg border-2 transition-all duration-200 ${
                              isSelected 
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-500' 
                                : 'bg-white border-gray-300'
                            }`}>
                            </div>
                            
                            {/* Hidden input for form functionality */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleQuestionTypeToggle(type as QuestionType)}
                              className="sr-only"
                            />
                            
                            <div className="flex-1">
                              <span className={`font-semibold text-base ${isSelected ? 'text-orange-800' : 'text-gray-700'}`}>
                                {label}
                              </span>
                            </div>
                            
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-8 text-center">
                    <div className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-100 to-red-100 border border-orange-200">
                      <span className="text-2xl">🎯</span>
                      <span className="font-bold text-orange-800">
                        選択中: {enabledQuestionTypes.length}種類
                      </span>
                    </div>
                  </div>
                </div>

                {/* 送信ボタン */}
                <div className="pt-8">
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 border border-indigo-100 mb-6">
                      <div className="text-4xl mb-4">🚀</div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">設定完了！</h3>
                      <p className="text-gray-600 mb-6">すべての設定が完了しました。クイズを開始しましょう！</p>
                      <button
                        type="submit"
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-12 rounded-2xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-xl text-lg"
                      >
                        <span className="flex items-center space-x-3">
                          <span>🎯</span>
                          <span>クイズを開始する</span>
                          <span>→</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};