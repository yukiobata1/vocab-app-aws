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
      const booksData = response.books.filter(book => book.question_count > 4);
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
      <div className="relative flex size-full min-h-screen flex-col justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-6"></div>
          <div className="text-2xl font-medium text-gray-700 mb-2">
            教材を読み込み中...
          </div>
          <div className="text-gray-500">
            しばらくお待ちください
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative flex size-full min-h-screen flex-col justify-between group/design-root overflow-x-hidden" 
      style={{
        '--select-button-svg': 'url(\'data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(78,112,151)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e\')',
        fontFamily: '"Noto Serif", "Noto Sans", sans-serif'
      } as React.CSSProperties}
    >
      <div>
        <div className="flex items-center p-4 pb-2 justify-between">
          <h2 className="text-[#0e141b] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pl-12 pr-12">単語クイズ作成</h2>
        </div>
        <h3 className="text-[#0e141b] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">教材選択</h3>
        <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
          <label className="flex flex-col min-w-40 flex-1">
            <select
              value={selectedBookId || ''}
              onChange={(e) => setSelectedBookId(Number(e.target.value))}
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0e141b] focus:outline-0 focus:ring-0 border border-[#d0dbe7] focus:border-[#d0dbe7] h-14 bg-[image:--select-button-svg] placeholder:text-[#4e7097] p-[15px] text-base font-normal leading-normal"
              required
            >
              <option value="">教材を選択</option>
              {books.map(book => (
                <option key={book.id} value={book.id}>
                  {book.name} - {book.level} ({book.question_count}問)
                </option>
              ))}
            </select>
          </label>
        </div>

        <h3 className="text-[#0e141b] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">出題範囲</h3>
        <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
          <label className="flex flex-col min-w-40 flex-1">
            <input
              type="number"
              min="1"
              value={lessonStart}
              onChange={(e) => setLessonStart(Number(e.target.value))}
              placeholder="開始"
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0e141b] focus:outline-0 focus:ring-0 border border-[#d0dbe7] focus:border-[#d0dbe7] h-14 placeholder:text-[#4e7097] p-[15px] text-base font-normal leading-normal"
              required
            />
          </label>
          <label className="flex flex-col min-w-40 flex-1">
            <input
              type="number"
              min="1"
              value={lessonEnd}
              onChange={(e) => setLessonEnd(Number(e.target.value))}
              placeholder="終了"
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0e141b] focus:outline-0 focus:ring-0 border border-[#d0dbe7] focus:border-[#d0dbe7] h-14 placeholder:text-[#4e7097] p-[15px] text-base font-normal leading-normal"
              required
            />
          </label>
        </div>

        <h3 className="text-[#0e141b] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">出題数</h3>
        <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
          <label className="flex flex-col min-w-40 flex-1">
            <input
              type="number"
              min="1"
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              placeholder="出題数を入力"
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0e141b] focus:outline-0 focus:ring-0 border border-[#d0dbe7] focus:border-[#d0dbe7] h-14 placeholder:text-[#4e7097] p-[15px] text-base font-normal leading-normal"
              required
            />
          </label>
        </div>

        <h3 className="text-[#0e141b] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">出題形式</h3>
        <div className="px-4 py-3">
          {Object.entries(questionTypeLabels).map(([type, label]) => {
            const isSelected = enabledQuestionTypes.includes(type as QuestionType);
            return (
              <div key={type} className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id={type}
                  checked={isSelected}
                  onChange={() => handleQuestionTypeToggle(type as QuestionType)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={type} className="text-[#0e141b] text-base font-normal leading-normal">
                  {label}
                </label>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4 rounded-r-lg">
              <div className="flex">
                <div>
                  <h3 className="text-sm font-medium text-red-800">エラーが発生しました</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex px-4 py-3">
            <button
              type="submit"
              className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 flex-1 bg-[#1873dc] text-slate-50 text-base font-bold leading-normal tracking-[0.015em]"
            >
              <span className="truncate">クイズを発行</span>
            </button>
          </div>
        </form>
        <div className="h-5"></div>
      </div>
    </div>
  );
};