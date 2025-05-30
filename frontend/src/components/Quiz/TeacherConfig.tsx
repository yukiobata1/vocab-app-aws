import React, { useState, useEffect } from 'react';
import { type QuizConfig, QuestionType, type VocabBook, type VocabQuestion } from '../../types/quiz';
import { vocabService } from '../../services/vocabService';
import { FieldAwareQuizFormatSelector, getQuestionTypeFromFormat } from './FieldAwareQuizFormatSelector';

interface TeacherConfigProps {
  onConfigSubmit: (config: QuizConfig) => void;
}

export const TeacherConfig: React.FC<TeacherConfigProps> = ({ onConfigSubmit }) => {
  const [books, setBooks] = useState<VocabBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [lessonStart, setLessonStart] = useState<number>(1);
  const [lessonEnd, setLessonEnd] = useState<number>(1);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType>(
    QuestionType.NEPALI_TO_KANJI
  );
  const [quizFormat, setQuizFormat] = useState({
    input1: 'ネパール語',
    input2: undefined as string | undefined,
    output: '漢字'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vocabularyQuestions, setVocabularyQuestions] = useState<VocabQuestion[]>([]);


  // Update selectedQuestionType when format changes
  const handleFormatChange = (format: { input1: string; input2: string | undefined; output: string }) => {
    setQuizFormat(format);
    setSelectedQuestionType(getQuestionTypeFromFormat(format.input1, format.output, format.input2));
  };


  useEffect(() => {
    loadBooks();
  }, []);

  useEffect(() => {
    if (selectedBookId) {
      loadVocabularyQuestions(selectedBookId);
    }
  }, [selectedBookId]);

  const loadBooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await vocabService.getBooks();
      const booksData = response.books.filter(book => book.question_count > 4);
      setBooks(booksData);
      if (booksData.length > 0 && selectedBookId === null) {
        setSelectedBookId(booksData[0].id);
      }
    } catch (err) {
      setError('教材の読み込みに失敗しました。ページを再読み込みしてください。');
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  };

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


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedBookId) {
      setError('教材を選択してください');
      return;
    }


    if (lessonStart > lessonEnd) {
      setError('開始課は終了課以下である必要があります');
      return;
    }
    if (lessonStart <= 0 || lessonEnd <= 0) {
        setError('課番号は1以上で入力してください。');
        return;
    }
    if (questionCount <=0) {
        setError('問題数は1問以上で入力してください。');
        return;
    }
     if (questionCount > 50) {
        setError('問題数は50問以下で入力してください。');
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
      enabledQuestionTypes: [selectedQuestionType],
      quizFormat: quizFormat,
    };

    onConfigSubmit(config);
  };

  const newGoldColor = "#C89F63"; // 新しい黄土色
  const crimsonColor = "#8C1515"; // えんじ色の代表例 (スタンフォードカーディナル)
  // より明るいえんじ色が必要な場合は、例えば #A70000 など

  if (loading && books.length === 0) {
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
    <div className="bg-white rounded-lg shadow-2xl p-6 md:p-8 max-w-2xl mx-auto my-8">
      <h2 
        className="text-3xl font-bold text-center mb-8"
        style={{ color: crimsonColor }}
      >
        単語クイズ作成
      </h2>

      <form onSubmit={handleSubmit}>
        {error && (
          <div 
            className="mb-6 p-4 border-l-4 rounded-md text-sm shadow-md"
            style={{ backgroundColor: '#FEE2E2', borderColor: crimsonColor, color: '#991B1B' }} // Tailwind red-100, red-700相当
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
          <div className="md:col-span-2">
            <label htmlFor="materialSelect" className="block text-sm font-medium mb-1" style={{color: crimsonColor}}>
              教材選択
            </label>
            <select
              id="materialSelect"
              value={selectedBookId ?? ''} 
              onChange={(e) => {
                const newBookId = Number(e.target.value);
                if (newBookId) setSelectedBookId(newBookId);
                setError(null); 
              }}
              className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out disabled:bg-gray-100 focus:outline-none focus:border-gray-500"
              required
              disabled={loading}
            >
              <option value="" disabled>教材を選択してください</option> 
              {books.map(book => (
                <option key={book.id} value={book.id}>
                  {book.name} - {book.level} ({book.question_count}問)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="lessonStartInput" className="block text-sm font-medium mb-1" style={{color: crimsonColor}}>
              開始課
            </label>
            <input
              id="lessonStartInput"
              type="number"
              min="1"
              value={lessonStart}
              onChange={(e) => {
                  setLessonStart(Number(e.target.value));
                  setError(null);
              }}
              className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
              required
            />
          </div>
          <div>
            <label htmlFor="lessonEndInput" className="block text-sm font-medium mb-1" style={{color: crimsonColor}}>
              終了課
            </label>
            <input
              id="lessonEndInput"
              type="number"
              min="1"
              value={lessonEnd}
              onChange={(e) => {
                  setLessonEnd(Number(e.target.value));
                  setError(null);
              }}
              className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <label htmlFor="questionCountInput" className="block text-sm font-medium mb-1" style={{color: crimsonColor}}>
              出題数 (最大50問)
            </label>
            <input
              id="questionCountInput"
              type="number"
              min="1"
              max="50"
              value={questionCount}
              onChange={(e) => {
                  setQuestionCount(Number(e.target.value));
                  setError(null);
              }}
              className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
              required
            />
          </div>

          <FieldAwareQuizFormatSelector
            value={quizFormat}
            onChange={handleFormatChange}
            allowMultipleInputs={true}
            vocabularyQuestions={vocabularyQuestions}
          />
        </div>

        <div className="mt-10 pt-2">
          <button
            type="submit"
            className="w-full text-white py-3.5 px-6 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-700 transition-all duration-150 ease-in-out shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ 
                backgroundColor: newGoldColor, 
            }}
            disabled={loading || !selectedBookId} 
          >
            {loading ? '処理中...' : 'クイズを発行'}
          </button>
        </div>
      </form>
    </div>
  );
};