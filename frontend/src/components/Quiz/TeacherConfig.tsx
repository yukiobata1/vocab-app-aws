import React, { useState, useEffect } from 'react';
import { QuizConfig, QuestionType } from '../../types/quiz';
import { VocabBook } from '../../config/api';
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
      <div className="flex justify-center items-center min-h-64">
        <div className="text-lg">教材を読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="teacher-config max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">クイズ設定</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 教材選択 */}
        <div className="form-group">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            教材選択
          </label>
          <select
            value={selectedBookId || ''}
            onChange={(e) => setSelectedBookId(Number(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">教材を選択してください</option>
            {books.map(book => (
              <option key={book.id} value={book.id}>
                {book.name} ({book.description || 'No description'})
              </option>
            ))}
          </select>
        </div>

        {/* 課の範囲 */}
        <div className="form-group">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            課の範囲
          </label>
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">開始課</label>
              <input
                type="number"
                min="1"
                value={lessonStart}
                onChange={(e) => setLessonStart(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">終了課</label>
              <input
                type="number"
                min="1"
                value={lessonEnd}
                onChange={(e) => setLessonEnd(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* 問題数 */}
        <div className="form-group">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            問題数
          </label>
          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {questionCountOptions.map(count => (
              <option key={count} value={count}>
                {count}問
              </option>
            ))}
          </select>
        </div>

        {/* 出題形式 */}
        <div className="form-group">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            出題形式（複数選択可）
          </label>
          <div className="space-y-2">
            {Object.entries(questionTypeLabels).map(([type, label]) => (
              <label
                key={type}
                className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={enabledQuestionTypes.includes(type as QuestionType)}
                  onChange={() => handleQuestionTypeToggle(type as QuestionType)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 送信ボタン */}
        <div className="form-group">
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            クイズを開始
          </button>
        </div>
      </form>
    </div>
  );
};