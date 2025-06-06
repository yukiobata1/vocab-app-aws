import React, { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import { type QuizConfig, QuestionType, type VocabBook, type VocabQuestion } from '../../types/quiz';
import { vocabService } from '../../services/vocabService';
import { FieldAwareQuizFormatSelector, getQuestionTypeFromFormat } from './FieldAwareQuizFormatSelector';
import { BookSelector } from './BookSelector';
import { LessonRangeSelector } from './LessonRangeSelector';
import { QuestionCountSelector } from './QuestionCountSelector';
import { colors } from '@/config/colors';
import { LoadingScreen } from '../common/LoadingScreen';

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

  const { newGoldColor, crimsonColor } = colors;
  if (loading && books.length === 0) {
    return <LoadingScreen message="教材を読み込み中..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow-2xl p-3 md:p-8 max-w-2xl mx-auto mt-2 md:mt-8">
      <h2 
        className="text-2xl md:text-3xl font-bold text-center mb-4 md:mb-8"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-6 gap-y-4 md:gap-y-8">
          <BookSelector
            books={books}
            selectedBookId={selectedBookId}
            onBookChange={(bookId) => {
              setSelectedBookId(bookId);
              setError(null);
            }}
            disabled={loading}
            loading={loading}
          />

          <LessonRangeSelector
            lessonStart={lessonStart}
            lessonEnd={lessonEnd}
            onLessonStartChange={(value) => {
              setLessonStart(value);
              setError(null);
            }}
            onLessonEndChange={(value) => {
              setLessonEnd(value);
              setError(null);
            }}
          />
          
          <QuestionCountSelector
            questionCount={questionCount}
            onQuestionCountChange={(value) => {
              setQuestionCount(value);
              setError(null);
            }}
          />

          <FieldAwareQuizFormatSelector
            value={quizFormat}
            onChange={handleFormatChange}
            allowMultipleInputs={true}
            vocabularyQuestions={vocabularyQuestions}
          />
        </div>

        <div className="mt-4 md:mt-10 pt-1 md:pt-2">
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !selectedBookId}
            sx={{
              width: '100%',
              backgroundColor: newGoldColor,
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              textTransform: 'none',
              borderRadius: '8px',
              padding: '14px 24px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.15s ease-in-out',
              '&:hover': {
                backgroundColor: newGoldColor,
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
            {loading ? '処理中...' : 'クイズを発行'}
          </Button>
        </div>
      </form>
    </div>
  );
};