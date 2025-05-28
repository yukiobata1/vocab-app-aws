import React, { useState } from 'react';
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

  const currentQuestion = quiz.questions[currentQuestionIndex];

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setSelectedAnswers(newAnswers);
    onAnswerSelect(currentQuestionIndex, answer);
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

  const renderQuestionContent = (question: QuizQuestion) => {
    switch (question.type) {
      case QuestionType.NEPALI_TO_KANJI:
        return (
          <div className="question-content">
            <h3 className="text-xl font-bold mb-4">ネパール語から漢字を選んでください</h3>
            <div className="nepali-text text-2xl font-bold text-blue-600 mb-6 p-4 bg-blue-50 rounded-lg">
              {question.questionText}
            </div>
          </div>
        );

      case QuestionType.NEPALI_TO_RUBI:
        return (
          <div className="question-content">
            <h3 className="text-xl font-bold mb-4">ネパール語から読みを選んでください</h3>
            <div className="nepali-text text-2xl font-bold text-blue-600 mb-6 p-4 bg-blue-50 rounded-lg">
              {question.questionText}
            </div>
          </div>
        );

      case QuestionType.KANJI_TO_RUBI:
        return (
          <div className="question-content">
            <h3 className="text-xl font-bold mb-4">漢字の読みを選んでください</h3>
            <div className="kanji-text text-3xl font-bold text-gray-800 mb-6 p-4 bg-gray-50 rounded-lg">
              {question.questionText}
            </div>
          </div>
        );

      case QuestionType.RUBI_TO_KANJI:
        return (
          <div className="question-content">
            <h3 className="text-xl font-bold mb-4">読みに対応する漢字を選んでください</h3>
            <div className="rubi-text text-2xl font-bold text-green-600 mb-6 p-4 bg-green-50 rounded-lg">
              {question.questionText}
            </div>
          </div>
        );

      case QuestionType.KANJI_TO_NEPALI:
        return (
          <div className="question-content">
            <h3 className="text-xl font-bold mb-4">漢字のネパール語の意味を選んでください</h3>
            <div className="kanji-text text-3xl font-bold text-gray-800 mb-6 p-4 bg-gray-50 rounded-lg">
              {question.questionText}
            </div>
          </div>
        );

      case QuestionType.RUBI_TO_NEPALI:
        return (
          <div className="question-content">
            <h3 className="text-xl font-bold mb-4">読みのネパール語の意味を選んでください</h3>
            <div className="rubi-text text-2xl font-bold text-green-600 mb-6 p-4 bg-green-50 rounded-lg">
              {question.questionText}
            </div>
          </div>
        );

      case QuestionType.FILL_IN_BLANK:
        return (
          <div className="question-content">
            <h3 className="text-xl font-bold mb-4">空欄に入る適切な語を選んでください</h3>
            <div className="sentence-text text-xl text-gray-700 mb-6 p-4 bg-yellow-50 rounded-lg">
              {question.questionText}
            </div>
          </div>
        );

      default:
        return (
          <div className="question-content">
            <h3 className="text-xl font-bold mb-4">問題</h3>
            <div className="question-text text-xl mb-6 p-4 bg-gray-50 rounded-lg">
              {question.questionText}
            </div>
          </div>
        );
    }
  };

  if (showResults) {
    const score = calculateScore();
    return (
      <div className="quiz-results max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-6">クイズ結果</h2>
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-600 mb-4">{score}%</div>
          <div className="text-lg text-gray-600 mb-6">
            {quiz.questions.length}問中{Math.round((score / 100) * quiz.questions.length)}問正解
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            新しいクイズを始める
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-display max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="quiz-header mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">
            問題 {currentQuestionIndex + 1} / {quiz.questions.length}
          </h2>
          <div className="text-sm text-gray-500">
            教材: {quiz.config.bookTitle} | 課: {quiz.config.lessonRange.start}-{quiz.config.lessonRange.end}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="question-section mb-8">
        {renderQuestionContent(currentQuestion)}
      </div>

      <div className="options-section mb-8">
        <div className="grid grid-cols-1 gap-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(option)}
              className={`p-4 text-left border-2 rounded-lg transition-colors ${
                selectedAnswers[currentQuestionIndex] === option
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center">
                <span className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full mr-3 text-sm font-medium">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-lg">{option}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="navigation-section flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="bg-gray-500 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded"
        >
          前へ
        </button>
        
        <button
          onClick={handleNext}
          disabled={!selectedAnswers[currentQuestionIndex]}
          className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded"
        >
          {currentQuestionIndex === quiz.questions.length - 1 ? '結果を見る' : '次へ'}
        </button>
      </div>
    </div>
  );
};