import React, { useState, useEffect } from 'react';

interface QuizData {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface StudentQuizProps {
  quizData: QuizData[];
  onQuizComplete: (score: number, totalQuestions: number) => void;
  studentName: string;
}

export const StudentQuiz: React.FC<StudentQuizProps> = ({ 
  quizData, 
  onQuizComplete, 
  studentName 
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<{[key: string]: string | null}>({});
  const [sounds, setSounds] = useState<{correct: HTMLAudioElement, incorrect: HTMLAudioElement} | null>(null);

  useEffect(() => {
    const correctSound = new Audio('/right.mp3');
    const incorrectSound = new Audio('/wrong.mp3');
    
    correctSound.load();
    incorrectSound.load();
    
    setSounds({ correct: correctSound, incorrect: incorrectSound });
  }, []);

  const handleOptionClick = (option: string) => {
    if (selectedOption || !sounds) return;

    setSelectedOption(option);
    
    const isCorrect = option === quizData[currentQuestionIndex].correctAnswer;
    if (isCorrect) {
      setScore(score + 1);
    }

    // 振動フィードバック
    if (navigator.vibrate) {
      navigator.vibrate(isCorrect ? 100 : 200);
    }

    // 音声フィードバック
    if (isCorrect) {
      sounds.correct.play().catch(e => console.log('音声の再生に失敗しました:', e));
    } else {
      sounds.incorrect.play().catch(e => console.log('音声の再生に失敗しました:', e));
    }

    const newFeedbackStates: {[key: string]: string | null} = {};
    quizData[currentQuestionIndex].options.forEach(opt => {
      if (opt === quizData[currentQuestionIndex].correctAnswer) {
        newFeedbackStates[opt] = 'correct';
      } else if (opt === option && option !== quizData[currentQuestionIndex].correctAnswer) {
        newFeedbackStates[opt] = 'incorrect';
      } else {
        newFeedbackStates[opt] = null;
      }
    });
    setFeedbackStates(newFeedbackStates);

    setTimeout(() => {
      if (currentQuestionIndex < quizData.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOption(null);
        setFeedbackStates({});
      } else {
        onQuizComplete(score + (isCorrect ? 1 : 0), quizData.length);
      }
    }, 2000);
  };

  if (quizData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <div className="text-xl text-gray-600">クイズの準備中...</div>
        </div>
      </div>
    );
  }

  const currentQuestion = quizData[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quizData.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {studentName}さんのクイズ
              </h1>
            </div>
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              問 {currentQuestionIndex + 1} / {quizData.length}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
            <div className="text-sm font-medium text-gray-600">
              {Math.round(progress)}%
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
          <div className="text-center">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white mb-8">
              <h2 className="text-4xl font-bold mb-2 leading-relaxed">
                {currentQuestion.question}
              </h2>
            </div>
          </div>

          {/* Options Grid - 2x2 layout like original */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentQuestion.options.map((option, index) => {
              let buttonClass = 'option-button relative p-6 text-xl font-medium rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 min-h-[100px] flex items-center justify-center';
              
              if (selectedOption) {
                if (feedbackStates[option] === 'correct') {
                  buttonClass += ' border-green-500 bg-green-50 text-green-800 shadow-lg';
                } else if (feedbackStates[option] === 'incorrect') {
                  buttonClass += ' border-red-500 bg-red-50 text-red-800 shadow-lg';
                } else if (option === currentQuestion.correctAnswer && selectedOption !== currentQuestion.correctAnswer) {
                  buttonClass += ' border-green-500 bg-green-50 text-green-800 shadow-lg';
                } else {
                  buttonClass += ' border-gray-200 bg-gray-50 text-gray-500';
                }
              } else {
                buttonClass += ' border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 shadow-md cursor-pointer text-gray-800';
              }

              return (
                <button
                  key={index}
                  className={buttonClass}
                  onClick={() => handleOptionClick(option)}
                  disabled={!!selectedOption}
                >
                  <span className="text-center leading-relaxed">{option}</span>
                  
                  {/* Feedback Icons */}
                  {selectedOption && feedbackStates[option] === 'correct' && (
                    <div className="absolute top-3 right-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg">✓</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedOption && feedbackStates[option] === 'incorrect' && (
                    <div className="absolute top-3 right-3">
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

        {/* Score Display */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-center space-x-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{score}</div>
              <div className="text-sm text-gray-500">正解数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{currentQuestionIndex + 1}</div>
              <div className="text-sm text-gray-500">回答済み</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{quizData.length - currentQuestionIndex - 1}</div>
              <div className="text-sm text-gray-500">残り</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};