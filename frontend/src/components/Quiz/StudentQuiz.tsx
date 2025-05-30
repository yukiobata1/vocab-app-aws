import React, { useState, useEffect } from 'react';
import { colors } from '../../config/colors';

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
  studentName: _studentName 
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<{[key: string]: string | null}>({});
  const [sounds, setSounds] = useState<{correct: HTMLAudioElement, incorrect: HTMLAudioElement} | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 seconds default

  useEffect(() => {
    const correctSound = new Audio('/right.mp3');
    const incorrectSound = new Audio('/wrong.mp3');
    
    correctSound.load();
    incorrectSound.load();
    
    setSounds({ correct: correctSound, incorrect: incorrectSound });
  }, []);

  // Reset quiz state when quizData changes (for retry functionality)
  useEffect(() => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedOption(null);
    setFeedbackStates({});
    setTimeRemaining(30); // Reset timer
  }, [quizData]);

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
        setTimeRemaining(30); // Reset timer for next question
      } else {
        onQuizComplete(score + (isCorrect ? 1 : 0), quizData.length);
      }
    }, 1200); // Reduced from 2000ms to 1200ms for faster feedback
  };

  // Timer effect
  useEffect(() => {
    if (selectedOption) return;
    
    if (timeRemaining === 0) {
      // Time's up - show correct answer
      const newFeedbackStates: {[key: string]: string | null} = {};
      quizData[currentQuestionIndex].options.forEach(opt => {
        if (opt === quizData[currentQuestionIndex].correctAnswer) {
          newFeedbackStates[opt] = 'correct';
        } else {
          newFeedbackStates[opt] = null;
        }
      });
      setFeedbackStates(newFeedbackStates);
      setSelectedOption('__timeout__'); // Special marker for timeout
      
      // Play incorrect sound for timeout
      if (sounds) {
        sounds.incorrect.play().catch(e => console.log('音声の再生に失敗しました:', e));
      }
      
      setTimeout(() => {
        if (currentQuestionIndex < quizData.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
          setSelectedOption(null);
          setFeedbackStates({});
          setTimeRemaining(30);
        } else {
          onQuizComplete(score, quizData.length);
        }
      }, 2000); // Show correct answer for 2 seconds on timeout
      return;
    }
    
    const timer = setTimeout(() => {
      setTimeRemaining(timeRemaining - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [timeRemaining, selectedOption, currentQuestionIndex, quizData, score, sounds]);

  if (quizData.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <div className="text-xl text-gray-600">クイズの準備中...</div>
        </div>
      </div>
    );
  }

  const currentQuestion = quizData[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          {/* Timer header */}
          <div className="flex justify-end items-center mb-2">
            <div className="text-sm text-gray-500">
              残り時間: <span className="font-medium" style={{ color: timeRemaining <= 10 ? colors.crimsonColor : '#374151' }}>{timeRemaining}秒</span>
            </div>
          </div>
          
          {/* Timer Progress Bar */}
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full"
                style={{ 
                  width: `${(timeRemaining / 30) * 100}%`,
                  backgroundColor: timeRemaining <= 10 ? '#EF4444' : '#9CA3AF',
                  transition: timeRemaining === 30 ? 'none' : 'width 1s linear'
                }}
              ></div>
            </div>
          </div>
          
          {/* Question Counter */}
          <div className="text-center mb-6">
            <span className="text-sm font-medium" style={{ color: colors.crimsonColor }}>
              {currentQuestionIndex + 1}/{quizData.length}
            </span>
          </div>
          
          <div className="text-center mb-8">
            <div className="text-2xl font-bold leading-relaxed" style={{ color: colors.crimsonColor }}>
              {currentQuestion.question.split('\n\n').map((part, index) => (
                <div key={index} className={index > 0 ? 'mt-4 text-lg text-gray-600' : ''}>
                  {part}
                </div>
              ))}
            </div>
          </div>

          {/* Options Grid - 2x2 layout like original */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentQuestion.options.map((option, index) => {
              let buttonClass = 'option-button relative p-6 text-xl font-medium rounded-xl border-2 transition-all duration-150 transform hover:scale-105 min-h-[100px] flex items-center justify-center';
              let buttonStyle: React.CSSProperties = {};
              
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
                buttonClass += ' bg-white shadow-md cursor-pointer text-gray-800 border-gray-200';
                buttonStyle = {};
              }

              return (
                <button
                  key={index}
                  className={buttonClass}
                  style={buttonStyle}
                  onClick={() => handleOptionClick(option)}
                  disabled={!!selectedOption || timeRemaining === 0}
                  onMouseEnter={(e) => {
                    if (!selectedOption) {
                      e.currentTarget.style.backgroundColor = '#FFFBEB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedOption) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
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

      </div>
    </div>
  );
};