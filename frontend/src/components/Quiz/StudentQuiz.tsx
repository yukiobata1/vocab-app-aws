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
}

export const StudentQuiz: React.FC<StudentQuizProps> = ({ 
  quizData, 
  onQuizComplete, 
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<{[key: string]: string | null}>({});
  const [sounds, setSounds] = useState<{correct: HTMLAudioElement, incorrect: HTMLAudioElement} | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 seconds default
  const [clickedOption, setClickedOption] = useState<string | null>(null); // Track which option was clicked for blue border
  const [hoveredOption, setHoveredOption] = useState<string | null>(null); // Track hovered option
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  useEffect(() => {
    // AudioContextを使った音声プリロード
    const initAudioContext = async () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(ctx);
        
        // 音声ファイルをプリロード
        const [correctBuffer, incorrectBuffer] = await Promise.all([
          fetch('/right.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)),
          fetch('/wrong.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
        ]);

        // HTMLAudioElementも併用（フォールバック）
        const correctSound = new Audio('/right.mp3');
        const incorrectSound = new Audio('/wrong.mp3');
        
        correctSound.preload = 'auto';
        incorrectSound.preload = 'auto';
        correctSound.volume = 0.7;
        incorrectSound.volume = 0.7;
        
        // 音声を完全にロード
        await Promise.all([
          new Promise((resolve) => {
            correctSound.addEventListener('canplaythrough', resolve, { once: true });
            correctSound.load();
          }),
          new Promise((resolve) => {
            incorrectSound.addEventListener('canplaythrough', resolve, { once: true });
            incorrectSound.load();
          })
        ]);

        setSounds({ correct: correctSound, incorrect: incorrectSound });
        setAudioInitialized(true);
        
        console.log('音声プリロード完了');
      } catch (error) {
        console.log('音声初期化エラー:', error);
        // フォールバック: 基本的な音声セットアップ
        const correctSound = new Audio('/right.mp3');
        const incorrectSound = new Audio('/wrong.mp3');
        correctSound.preload = 'auto';
        incorrectSound.preload = 'auto';
        correctSound.load();
        incorrectSound.load();
        setSounds({ correct: correctSound, incorrect: incorrectSound });
        setAudioInitialized(true);
      }
    };

    initAudioContext();

    // ユーザーインタラクションで音声コンテキストを有効化
    const enableAudio = async () => {
      if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('AudioContext resumed');
      }
    };

    document.addEventListener('touchstart', enableAudio, { once: true });
    document.addEventListener('click', enableAudio, { once: true });

    return () => {
      document.removeEventListener('touchstart', enableAudio);
      document.removeEventListener('click', enableAudio);
      if (audioContext) {
        audioContext.close();
      }
    };
  }, []);

  // Reset quiz state when quizData changes (for retry functionality)
  useEffect(() => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedOption(null);
    setFeedbackStates({});
    setClickedOption(null);
    setHoveredOption(null);
    setTimeRemaining(30); // Reset timer
  }, [quizData]);

  const handleOptionClick = (option: string) => {
    if (selectedOption || !sounds || !audioInitialized) return;

    setSelectedOption(option);
    setClickedOption(option); // Remember which option was clicked
    
    const isCorrect = option === quizData[currentQuestionIndex].correctAnswer;
    if (isCorrect) {
      setScore(score + 1);
    }

    // 振動フィードバック
    if (navigator.vibrate) {
      navigator.vibrate(isCorrect ? 100 : 200);
    }

    // より確実な音声フィードバック
    const playSound = async (audioElement: HTMLAudioElement) => {
      try {
        // 音声をリセットして再生
        audioElement.currentTime = 0;
        await audioElement.play();
      } catch (error) {
        console.log('音声の再生に失敗しました:', error);
        // フォールバック: 少し待って再試行
        setTimeout(() => {
          audioElement.currentTime = 0;
          audioElement.play().catch(e => console.log('再試行も失敗:', e));
        }, 100);
      }
    };

    if (isCorrect) {
      playSound(sounds.correct);
    } else {
      playSound(sounds.incorrect);
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
      // 次の問題に移る前にフォーカスをクリア
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      
      if (currentQuestionIndex < quizData.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOption(null);
        setFeedbackStates({});
        setClickedOption(null); // Clear clicked option for next question
        setHoveredOption(null); // Clear hovered option for next question
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
        // 次の問題に移る前にフォーカスをクリア
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        
        if (currentQuestionIndex < quizData.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
          setSelectedOption(null);
          setFeedbackStates({});
          setClickedOption(null); // Clear clicked option for next question
          setHoveredOption(null); // Clear hovered option for next question
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
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
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
            <div className="leading-relaxed">
              {currentQuestion.question.split('\n').map((part, index) => {
                // Check if this line contains field labels (for compound questions)
                const isFieldLabel = part.includes('：') && (
                  part.includes('漢字：') || 
                  part.includes('読み：') || 
                  part.includes('ネパール語：') ||
                  part.includes('意味：')
                );
                
                // Extract label and value for better formatting
                if (isFieldLabel) {
                  const [label, ...valueParts] = part.split('：');
                  const value = valueParts.join('：');
                  
                  return (
                    <div key={index} className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 mb-1">{label}</div>
                      <div className="text-xl font-bold" style={{ color: colors.crimsonColor }}>
                        {value}
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div 
                    key={index} 
                    className={`${
                      index === 0 
                        ? 'text-2xl font-bold mb-4' 
                        : 'text-lg text-gray-600 mb-2'
                    }`}
                    style={{ color: index === 0 ? colors.crimsonColor : undefined }}
                  >
                    {part}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Options Grid - 2x2 layout like original */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {currentQuestion.options.map((option, index) => {
              let buttonClass = 'option-button relative p-4 md:p-6 text-lg md:text-xl font-medium rounded-xl border-2 transition-all duration-150 transform hover:md:scale-105 min-h-[80px] md:min-h-[100px] flex items-center justify-center';
              let buttonStyle: React.CSSProperties = {};
              
              // Add blue border for clicked option
              const isClicked = clickedOption === option;
              const isHovered = hoveredOption === option;
              
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
                // Handle hover state properly
                if (isHovered && !('ontouchstart' in window)) {
                  buttonClass += ' bg-amber-50 shadow-md cursor-pointer text-gray-800 border-gray-200';
                } else {
                  buttonClass += ' bg-white shadow-md cursor-pointer text-gray-800 border-gray-200';
                }
              }
              
              // Apply blue outline if this option was clicked
              if (isClicked) {
                buttonStyle.outline = '2px solid #3B82F6';
                buttonStyle.outlineOffset = '2px';
              }

              return (
                <button
                  key={`${currentQuestionIndex}-${index}`}
                  className={buttonClass}
                  style={buttonStyle}
                  onClick={() => handleOptionClick(option)}
                  disabled={!!selectedOption || timeRemaining === 0}
                  onMouseEnter={() => {
                    // モバイルデバイスまたは選択済みの場合はマウスイベントを無視
                    if ('ontouchstart' in window || selectedOption) {
                      return;
                    }
                    setHoveredOption(option);
                  }}
                  onMouseLeave={() => {
                    // モバイルデバイスまたは選択済みの場合はマウスイベントを無視
                    if ('ontouchstart' in window || selectedOption) {
                      return;
                    }
                    setHoveredOption(null);
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