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
  const [sounds, setSounds] = useState<{correct: HTMLAudioElement, incorrect: HTMLAudioElement} | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 seconds default
  const [tappedOption, setTappedOption] = useState<string | null>(null); // Track which option was just tapped
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  useEffect(() => {
    // AudioContextを使った音声プリロード
    const initAudioContext = async () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(ctx);
        
        // 音声ファイルをプリロード (AudioContextで将来使用予定)
        await Promise.all([
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
    setTappedOption(null);
    setTimeRemaining(30);
  }, [quizData]);

  const handleOptionClick = (option: string) => {
    if (selectedOption || !sounds || !audioInitialized) return;

    // 即座にフォーカスとアクティブ状態をクリア (iOS対応強化)
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
      // iOS Safari用の追加クリア
      activeElement.style.outline = 'none';
      activeElement.style.webkitAppearance = 'none';
    }

    setSelectedOption(option);
    setTappedOption(option); // Brief tap feedback
    
    // Clear tap feedback quickly since we're recreating components
    setTimeout(() => {
      setTappedOption(null);
    }, 150);
    
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

    // No need for feedbackStates - we determine colors directly in render

    setTimeout(() => {
      if (currentQuestionIndex < quizData.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOption(null);
        setTappedOption(null);
        setTimeRemaining(30);
      } else {
        onQuizComplete(score + (isCorrect ? 1 : 0), quizData.length);
      }
    }, 1200);
  };

  // Timer effect
  useEffect(() => {
    if (selectedOption) return;
    
    if (timeRemaining === 0) {
      // Time's up - mark as timeout to show correct answer
      setSelectedOption('__timeout__'); // Special marker for timeout
      
      // Play incorrect sound for timeout
      if (sounds) {
        sounds.incorrect.play().catch(e => console.log('音声の再生に失敗しました:', e));
      }
      
      setTimeout(() => {
        if (currentQuestionIndex < quizData.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
          setSelectedOption(null);
          setTappedOption(null);
          setTimeRemaining(30);
        } else {
          onQuizComplete(score, quizData.length);
        }
      }, 2000);
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
              // Create a new option component every time based on current state
              const OptionButton = () => {
                // Determine button style based on current state
                let baseClass = 'option-button p-4 md:p-6 text-lg md:text-xl font-medium rounded-xl transition-all duration-150 min-h-[80px] md:min-h-[100px] flex items-center justify-center';
                let buttonStyle: React.CSSProperties = {
                  WebkitAppearance: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  outline: 'none',
                  outlineStyle: 'none',
                  outlineWidth: '0',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  boxSizing: 'border-box'
                };

                // Determine final style based on current state
                if (selectedOption) {
                  // Answer has been selected - show feedback
                  if (option === currentQuestion.correctAnswer) {
                    // This is the correct answer
                    return (
                      <div
                        key={`correct-${currentQuestionIndex}-${index}`}
                        className={`${baseClass} cursor-default select-none`}
                        style={{
                          ...buttonStyle,
                          backgroundColor: '#bbf7d0', // green-200
                          borderColor: '#10b981', // green-500
                          color: '#14532d', // green-900
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          animation: 'pulse 1s ease-in-out infinite'
                        }}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span>✓</span>
                          <span className="text-center">{option}</span>
                        </span>
                      </div>
                    );
                  } else if (option === selectedOption) {
                    // This was the selected (incorrect) answer
                    return (
                      <div
                        key={`incorrect-${currentQuestionIndex}-${index}`}
                        className={`${baseClass} cursor-default select-none`}
                        style={{
                          ...buttonStyle,
                          backgroundColor: '#fecaca', // red-200
                          borderColor: '#ef4444', // red-500
                          color: '#7f1d1d', // red-900
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          transition: 'all 0.3s ease-in-out'
                        }}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span>✗</span>
                          <span className="text-center">{option}</span>
                        </span>
                      </div>
                    );
                  } else {
                    // Other options (neutral)
                    return (
                      <div
                        key={`neutral-${currentQuestionIndex}-${index}`}
                        className={`${baseClass} bg-gray-50 text-gray-500 cursor-default select-none opacity-50`}
                        style={{
                          ...buttonStyle,
                          border: '2px solid #E5E7EB',
                          borderColor: '#E5E7EB'
                        }}
                      >
                        <span className="block text-center w-full">{option}</span>
                      </div>
                    );
                  }
                } else {
                  // No answer selected yet - show default state
                  const isTapped = tappedOption === option;
                  if (isTapped) {
                    return (
                      <div
                        key={`tapped-${currentQuestionIndex}-${index}`}
                        className={`${baseClass} bg-blue-100 shadow-lg cursor-pointer text-gray-800 transform scale-95 select-none`}
                        style={{
                          ...buttonStyle,
                          border: '2px solid #93C5FD',
                          borderColor: '#93C5FD'
                        }}
                        onClick={() => handleOptionClick(option)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.webkitTapHighlightColor = 'transparent';
                        }}
                      >
                        <span className="block text-center w-full">{option}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={`default-${currentQuestionIndex}-${index}`}
                        className={`${baseClass} bg-white shadow-md cursor-pointer text-gray-800 active:scale-95 select-none`}
                        style={{
                          ...buttonStyle,
                          border: '2px solid #E5E7EB',
                          borderColor: '#E5E7EB'
                        }}
                        onClick={() => !selectedOption && timeRemaining > 0 && handleOptionClick(option)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.webkitTapHighlightColor = 'transparent';
                        }}
                      >
                        <span className="block text-center w-full">{option}</span>
                      </div>
                    );
                  }
                }
              };

              return <OptionButton key={`option-${currentQuestionIndex}-${index}-${option}`} />;
            })}
          </div>
        </div>

      </div>
    </div>
  );
};