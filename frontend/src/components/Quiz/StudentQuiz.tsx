import React, { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
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
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [tappedOption, setTappedOption] = useState<string | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false); // Track user interaction for audio context

  // Auto-scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const initAudio = () => {
      try {
        // シンプルな単一インスタンス音声作成
        const correctAudio = new Audio('/right.mp3');
        const incorrectAudio = new Audio('/wrong.mp3');
        
        // 基本設定
        correctAudio.preload = 'auto';
        incorrectAudio.preload = 'auto';
        correctAudio.volume = 1.0; // 最大音量
        incorrectAudio.volume = 1.0; // 最大音量

        setSounds({ correct: correctAudio, incorrect: incorrectAudio });
        setAudioInitialized(true);
        
        console.log('音声初期化完了');
      } catch (error) {
        console.log('音声初期化エラー:', error);
        setAudioInitialized(true);
      }
    };

    initAudio();

    // ユーザーインタラクションの検出（スマートフォン音声再生のため）
    const handleFirstInteraction = () => {
      setUserInteracted(true);
      console.log('ユーザーインタラクション検出 - 音声再生可能');
    };

    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    document.addEventListener('click', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
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

  // 問題が変わったときの処理
  useEffect(() => {
    // 音声を停止
    if (sounds) {
      sounds.correct.pause();
      sounds.correct.currentTime = 0;
      sounds.incorrect.pause();
      sounds.incorrect.currentTime = 0;
    }
  }, [currentQuestionIndex, sounds]);

  // 音声再生関数
  const playSound = async (audio: HTMLAudioElement, type: 'correct' | 'incorrect') => {
    // ユーザーインタラクションがない場合は再生しない（スマートフォン対応）
    if (!userInteracted) {
      console.log(`音声再生スキップ (ユーザーインタラクションなし): ${type}`);
      return;
    }

    try {
      // 音声を停止してリセット
      audio.pause();
      audio.currentTime = 0;
      
      // 再生を試行
      await audio.play();
      console.log(`${type} sound played successfully`);
    } catch (error) {
      console.log(`音声再生失敗 (${type}):`, error);
      // スマートフォンでは特定の条件下で音声再生が失敗することがある
      // - autoplay policy violations
      // - insufficient user gesture
      // - audio context suspended
    }
  };

  const handleOptionClick = (option: string) => {
    // クリックできない条件をチェック
    if (selectedOption || !sounds || !audioInitialized || timeRemaining === 0) {
      return;
    }

    console.log('オプションクリック:', option);
    
    // ユーザーインタラクションを記録
    if (!userInteracted) {
      setUserInteracted(true);
    }

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

    // 音声再生
    if (isCorrect) {
      playSound(sounds.correct, 'correct');
    } else {
      playSound(sounds.incorrect, 'incorrect');
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

  // Timer effect - 正確な1秒間隔を保つ
  useEffect(() => {
    if (selectedOption) return;
    
    if (timeRemaining <= 0) {
      // Time's up - mark as timeout to show correct answer
      setSelectedOption('__timeout__'); // Special marker for timeout
      
      // Play incorrect sound for timeout
      if (sounds && userInteracted) {
        playSound(sounds.incorrect, 'incorrect');
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
    
    // より正確なタイマー：1000msではなく実際の経過時間をチェック
    const startTime = Date.now();
    const timer = setTimeout(() => {
      const elapsed = Date.now() - startTime;
      // 実際の経過時間が1000ms以上の場合のみタイマーを減らす
      if (elapsed >= 950) { // 50msの余裕を持たせる
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [timeRemaining, selectedOption, currentQuestionIndex, quizData, score, sounds, userInteracted]);

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
    <div className="min-h-screen bg-gray-50 p-2 md:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-lg p-3 md:p-6 mb-3 md:mb-6">
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
          <div className="text-center mb-3 md:mb-6">
            <span className="text-sm font-medium" style={{ color: colors.crimsonColor }}>
              {currentQuestionIndex + 1}/{quizData.length}
            </span>
          </div>
          
          <div className="text-center mb-4 md:mb-8">
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
                    <div key={index} className="mb-2 md:mb-3 p-2 md:p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs md:text-sm font-medium text-gray-600 mb-1">{label}</div>
                      <div className="text-lg md:text-xl font-bold" style={{ color: colors.crimsonColor }}>
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
                        ? 'text-xl md:text-2xl font-bold mb-2 md:mb-4' 
                        : 'text-base md:text-lg text-gray-600 mb-1 md:mb-2'
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
            {currentQuestion.options.map((option, index) => {
              // Create a new option component every time based on current state
              const OptionButton = () => {
                // Material-UI buttons don't need these custom styles

                // Determine final style based on current state
                if (selectedOption) {
                  // Answer has been selected - show feedback
                  if (option === currentQuestion.correctAnswer) {
                    // This is the correct answer
                    return (
                      <Button
                        key={`correct-${currentQuestionIndex}-${index}`}
                        variant="contained"
                        disabled={true}
                        sx={{
                          backgroundColor: '#bbf7d0',
                          color: '#14532d',
                          border: '2px solid #10b981',
                          borderRadius: '12px',
                          minHeight: { xs: '60px', md: '100px' },
                          fontSize: { xs: '18px', md: '20px' },
                          fontWeight: 'medium',
                          textTransform: 'none',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          animation: 'pulse 1s ease-in-out infinite',
                          '&:hover': {
                            backgroundColor: '#bbf7d0',
                          },
                          '&.Mui-disabled': {
                            backgroundColor: '#bbf7d0',
                            color: '#14532d',
                            border: '2px solid #10b981',
                          }
                        }}
                      >
                        <span>✓</span>
                        <span>{option}</span>
                      </Button>
                    );
                  } else if (option === selectedOption) {
                    // This was the selected (incorrect) answer
                    return (
                      <Button
                        key={`incorrect-${currentQuestionIndex}-${index}`}
                        variant="contained"
                        disabled={true}
                        sx={{
                          backgroundColor: '#fecaca',
                          color: '#7f1d1d',
                          border: '2px solid #ef4444',
                          borderRadius: '12px',
                          minHeight: { xs: '60px', md: '100px' },
                          fontSize: { xs: '18px', md: '20px' },
                          fontWeight: 'medium',
                          textTransform: 'none',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.3s ease-in-out',
                          '&:hover': {
                            backgroundColor: '#fecaca',
                          },
                          '&.Mui-disabled': {
                            backgroundColor: '#fecaca',
                            color: '#7f1d1d',
                            border: '2px solid #ef4444',
                          }
                        }}
                      >
                        <span>✗</span>
                        <span>{option}</span>
                      </Button>
                    );
                  } else {
                    // Other options (neutral)
                    return (
                      <Button
                        key={`neutral-${currentQuestionIndex}-${index}`}
                        variant="outlined"
                        disabled={true}
                        sx={{
                          backgroundColor: '#F9FAFB',
                          color: '#6B7280',
                          border: '2px solid #E5E7EB',
                          borderRadius: '12px',
                          minHeight: { xs: '60px', md: '100px' },
                          fontSize: { xs: '18px', md: '20px' },
                          fontWeight: 'medium',
                          textTransform: 'none',
                          width: '100%',
                          opacity: 0.5,
                          '&.Mui-disabled': {
                            backgroundColor: '#F9FAFB',
                            color: '#6B7280',
                            border: '2px solid #E5E7EB',
                            opacity: 0.5,
                          }
                        }}
                      >
                        {option}
                      </Button>
                    );
                  }
                } else {
                  // No answer selected yet - show default state
                  const isTapped = tappedOption === option;
                  if (isTapped) {
                    return (
                      <Button
                        key={`tapped-${currentQuestionIndex}-${index}`}
                        variant="contained"
                        onClick={() => handleOptionClick(option)}
                        disabled={timeRemaining === 0 || selectedOption !== null}
                        sx={{
                          backgroundColor: '#DBEAFE',
                          color: '#1F2937',
                          border: '2px solid #93C5FD',
                          borderRadius: '12px',
                          minHeight: { xs: '60px', md: '100px' },
                          fontSize: { xs: '18px', md: '20px' },
                          fontWeight: 'medium',
                          textTransform: 'none',
                          width: '100%',
                          transform: 'scale(0.95)',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          '&:hover': {
                            backgroundColor: '#DBEAFE',
                          },
                          '&.Mui-disabled': {
                            backgroundColor: '#F3F4F6',
                            color: '#9CA3AF',
                            border: '2px solid #E5E7EB',
                            opacity: 0.6,
                          }
                        }}
                      >
                        {option}
                      </Button>
                    );
                  } else {
                    return (
                      <Button
                        key={`default-${currentQuestionIndex}-${index}`}
                        variant="outlined"
                        onClick={() => handleOptionClick(option)}
                        disabled={timeRemaining === 0 || selectedOption !== null}
                        sx={{
                          backgroundColor: '#FFFFFF',
                          color: '#1F2937',
                          border: '2px solid #E5E7EB',
                          borderRadius: '12px',
                          minHeight: { xs: '60px', md: '100px' },
                          fontSize: { xs: '18px', md: '20px' },
                          fontWeight: 'medium',
                          textTransform: 'none',
                          width: '100%',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.15s ease-in-out',
                          '&:hover': {
                            backgroundColor: '#F9FAFB',
                            borderColor: '#D1D5DB',
                          },
                          '&:active': {
                            transform: 'scale(0.95)',
                          },
                          '&.Mui-disabled': {
                            backgroundColor: '#F3F4F6',
                            color: '#9CA3AF',
                            border: '2px solid #E5E7EB',
                            opacity: 0.6,
                          }
                        }}
                      >
                        {option}
                      </Button>
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