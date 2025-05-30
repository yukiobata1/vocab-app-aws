import React, { useState, useEffect } from 'react';
import type { Quiz, QuizQuestion } from '../../types/quiz';
import { QuestionType } from '../../types/quiz';

interface QuizDisplayProps {
  quiz: Quiz;
  onAnswerSelect: (questionIndex: number, selectedAnswer: string) => void;
  onQuizComplete: (score: number) => void;
}

export const QuizDisplay: React.FC<QuizDisplayProps> = ({
  quiz,
  onAnswerSelect,
  onQuizComplete
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(new Array(quiz.questions.length).fill(''));
  const [showResults, setShowResults] = useState(false);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState<boolean[]>(new Array(quiz.questions.length).fill(false));

  const currentQuestion = quiz.questions[currentQuestionIndex];

  // Audio setup
  useEffect(() => {
    // Preload audio files
    const rightAudio = new Audio('/right.mp3');
    const wrongAudio = new Audio('/wrong.mp3');
    rightAudio.preload = 'auto';
    wrongAudio.preload = 'auto';
  }, []);

  const playSound = (isCorrect: boolean) => {
    try {
      const audio = new Audio(isCorrect ? '/right.mp3' : '/wrong.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (e) {
      console.log('Audio failed:', e);
    }
  };

  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setSelectedAnswers(newAnswers);
    onAnswerSelect(currentQuestionIndex, answer);

    // Check if answer is correct
    const isCorrect = answer === currentQuestion.correctAnswer;
    const newCorrectAnswers = [...correctAnswers];
    newCorrectAnswers[currentQuestionIndex] = isCorrect;
    setCorrectAnswers(newCorrectAnswers);

    // Show feedback
    setShowFeedback(isCorrect ? 'correct' : 'wrong');
    
    // Play sound and vibrate
    playSound(isCorrect);
    vibrate(isCorrect ? [100, 50, 100] : [200, 100, 200, 100, 200]);

    // Hide feedback after animation
    setTimeout(() => {
      setShowFeedback(null);
    }, 1500);
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      const score = calculateScore();
      setShowResults(true);
      onQuizComplete(score);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    quiz.questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correctAnswer) {
        correct++;
      }
    });
    return Math.round((correct / quiz.questions.length) * 100);
  };

  const getQuestionTypeIcon = (type: QuestionType) => {
    switch (type) {
      case QuestionType.NEPALI_TO_KANJI:
        return '🇳🇵→漢';
      case QuestionType.NEPALI_TO_RUBI:
        return '🇳🇵→あ';
      case QuestionType.KANJI_TO_RUBI:
        return '漢→あ';
      case QuestionType.RUBI_TO_KANJI:
        return 'あ→漢';
      case QuestionType.KANJI_TO_NEPALI:
        return '漢→🇳🇵';
      case QuestionType.RUBI_TO_NEPALI:
        return 'あ→🇳🇵';
      case QuestionType.FILL_IN_BLANK:
      case QuestionType.FILL_IN_BLANK_TO_RUBI:
      case QuestionType.FILL_IN_BLANK_TO_NEPALI:
        return '🔤';
      case QuestionType.FILL_IN_BLANK_NEPALI_TO_KANJI:
        return '🔤🇳🇵→漢';
      case QuestionType.FILL_IN_BLANK_NEPALI_TO_RUBI:
        return '🔤🇳🇵→あ';
      case QuestionType.FILL_IN_BLANK_KANJI_TO_NEPALI:
        return '🔤漢→🇳🇵';
      case QuestionType.FILL_IN_BLANK_KANJI_TO_RUBI:
        return '🔤漢→あ';
      case QuestionType.FILL_IN_BLANK_RUBI_TO_NEPALI:
        return '🔤あ→🇳🇵';
      case QuestionType.FILL_IN_BLANK_RUBI_TO_KANJI:
        return '🔤あ→漢';
      default:
        return '❓';
    }
  };

  const getQuestionTypeColor = (type: QuestionType) => {
    switch (type) {
      case QuestionType.NEPALI_TO_KANJI:
        return 'from-blue-500 to-purple-600';
      case QuestionType.NEPALI_TO_RUBI:
        return 'from-green-500 to-blue-600';
      case QuestionType.KANJI_TO_RUBI:
        return 'from-purple-500 to-pink-600';
      case QuestionType.RUBI_TO_KANJI:
        return 'from-pink-500 to-red-600';
      case QuestionType.KANJI_TO_NEPALI:
        return 'from-orange-500 to-red-600';
      case QuestionType.RUBI_TO_NEPALI:
        return 'from-teal-500 to-green-600';
      case QuestionType.FILL_IN_BLANK:
        return 'from-indigo-500 to-purple-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const renderQuestionContent = (question: QuizQuestion) => {
    const bgClass = getQuestionTypeColor(question.type);
    
    return (
      <div className="relative">
        <div className={`bg-gradient-to-r ${bgClass} rounded-2xl p-8 text-white shadow-xl`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{getQuestionTypeIcon(question.type)}</span>
              <span className="text-lg font-semibold opacity-90">
                {question.type === QuestionType.NEPALI_TO_KANJI && 'ネパール語 → 漢字'}
                {question.type === QuestionType.NEPALI_TO_RUBI && 'ネパール語 → 読み'}
                {question.type === QuestionType.KANJI_TO_RUBI && '漢字 → 読み'}
                {question.type === QuestionType.RUBI_TO_KANJI && '読み → 漢字'}
                {question.type === QuestionType.KANJI_TO_NEPALI && '漢字 → ネパール語'}
                {question.type === QuestionType.RUBI_TO_NEPALI && '読み → ネパール語'}
                {question.type === QuestionType.FILL_IN_BLANK && '空欄補充'}
              </span>
            </div>
            <div className="text-sm opacity-75">
              問 {currentQuestionIndex + 1}/{quiz.questions.length}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-4xl font-bold mb-4 leading-relaxed">
              {question.questionText}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (showResults) {
    const score = calculateScore();
    const correctCount = Math.round((score / 100) * quiz.questions.length);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-12 text-center">
            <div className="mb-8">
              {score >= 80 ? (
                <div className="text-8xl mb-4">🎉</div>
              ) : score >= 60 ? (
                <div className="text-8xl mb-4">👏</div>
              ) : (
                <div className="text-8xl mb-4">📚</div>
              )}
            </div>
            
            <h2 className="text-4xl font-bold text-gray-800 mb-6">クイズ完了！</h2>
            
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white mb-8">
              <div className="text-6xl font-bold mb-2">{score}%</div>
              <div className="text-xl opacity-90">
                {quiz.questions.length}問中 {correctCount}問正解
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-2xl text-green-600">✓</div>
                <div className="text-lg font-semibold text-green-800">{correctCount}</div>
                <div className="text-sm text-green-600">正解</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <div className="text-2xl text-red-600">✗</div>
                <div className="text-lg font-semibold text-red-800">{quiz.questions.length - correctCount}</div>
                <div className="text-sm text-red-600">不正解</div>
              </div>
            </div>
            
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <span className="flex items-center space-x-2">
                <span>🚀</span>
                <span>新しいクイズを始める</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">
              {quiz.config.bookTitle}
            </h1>
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              課 {quiz.config.lessonRange.start}-{quiz.config.lessonRange.end}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>進捗</span>
                <span>{currentQuestionIndex + 1} / {quiz.questions.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Question Section */}
        <div className="mb-8">
          {renderQuestionContent(currentQuestion)}
        </div>

        {/* Answer Options - 2x2 Grid */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswers[currentQuestionIndex] === option;
              const isCorrect = option === currentQuestion.correctAnswer;
              const showCorrectAnswer = selectedAnswers[currentQuestionIndex] && isCorrect;
              const showWrongAnswer = selectedAnswers[currentQuestionIndex] && isSelected && !isCorrect;
              
              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={!!selectedAnswers[currentQuestionIndex]}
                  className={`relative p-6 text-lg font-medium rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
                    showCorrectAnswer
                      ? 'border-green-500 bg-green-50 text-green-800 shadow-lg'
                      : showWrongAnswer
                      ? 'border-red-500 bg-red-50 text-red-800 shadow-lg'
                      : isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 shadow-md'
                  } ${
                    selectedAnswers[currentQuestionIndex] ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-center min-h-[80px]">
                    <span className="text-center leading-relaxed">{option}</span>
                  </div>
                  
                  {showCorrectAnswer && (
                    <div className="absolute top-2 right-2">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg">✓</span>
                      </div>
                    </div>
                  )}
                  
                  {showWrongAnswer && (
                    <div className="absolute top-2 right-2">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg">✗</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback Overlay */}
        {showFeedback && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`transform transition-all duration-500 ${
              showFeedback === 'correct' 
                ? 'animate-bounce bg-green-500' 
                : 'animate-pulse bg-red-500'
            } rounded-full p-8 shadow-2xl`}>
              <div className="text-6xl text-white">
                {showFeedback === 'correct' ? '✓' : '✗'}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 font-medium py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
            >
              <span>←</span>
              <span>前へ</span>
            </button>
            
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">回答状況</div>
              <div className="flex space-x-1">
                {quiz.questions.map((_, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full ${
                      index === currentQuestionIndex
                        ? 'bg-blue-500'
                        : selectedAnswers[index]
                        ? correctAnswers[index]
                          ? 'bg-green-500'
                          : 'bg-red-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <button
              onClick={handleNext}
              disabled={!selectedAnswers[currentQuestionIndex]}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-105"
            >
              <span>{currentQuestionIndex === quiz.questions.length - 1 ? '結果を見る' : '次へ'}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};