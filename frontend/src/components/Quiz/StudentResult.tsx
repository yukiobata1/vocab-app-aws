import React, { useEffect, useState, useRef } from 'react';
import Button from '@mui/material/Button';
import { ScoreManager } from '../../utils/scoreManager';
import { colors } from '../../config/colors';

interface StudentResultProps {
  score: number;
  totalQuestions: number;
  studentName: string;
  onRestart: () => void;
}

export const StudentResult: React.FC<StudentResultProps> = ({ 
  score, 
  totalQuestions, 
  studentName, 
  onRestart
}) => {
  const [personalBest, setPersonalBest] = useState<number>(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [showEffect, setShowEffect] = useState(false);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const hasPlayedAudio = useRef(false);

  // Auto-scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Preload audio files
  useEffect(() => {
    const audioFiles = {
      '100': '/100.mp3',           // ファンファーレ
      '80_100': '/80_100.mp3',     // 大歓声  
      '40_80': '/40_80.mp3',       // テッテレー
      '0_40': '/0_40.mp3'          // 残念...
    };

    Object.entries(audioFiles).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.load();
      audioRefs.current[key] = audio;
    });

    // Cleanup function
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, []);

  useEffect(() => {
    // Save current score
    ScoreManager.saveScore(score, totalQuestions, studentName);
    
    // Get personal best
    const personalBestRecord = ScoreManager.getPersonalBest(studentName);
    
    const currentPercentage = Math.round((score / totalQuestions) * 100);
    
    if (personalBestRecord) {
      setPersonalBest(personalBestRecord.percentage);
      setIsNewRecord(currentPercentage >= personalBestRecord.percentage && currentPercentage > 50);
    } else {
      setPersonalBest(currentPercentage);
      setIsNewRecord(currentPercentage > 50);
    }

    // Play audio and show effects
    if (!hasPlayedAudio.current) {
      hasPlayedAudio.current = true;
      
      setTimeout(() => {
        playScoreAudio(currentPercentage);
        setShowEffect(true);
        
        // Hide effect after animation
        setTimeout(() => setShowEffect(false), 3000);
      }, 500);
    }
  }, [score, totalQuestions, studentName]);

  const playScoreAudio = (percentage: number) => {
    let audioKey: string;
    
    if (percentage === 100) {
      audioKey = '100';
    } else if (percentage >= 80) {
      audioKey = '80_100';
    } else if (percentage >= 40) {
      audioKey = '40_80';
    } else {
      audioKey = '0_40';
    }

    const audio = audioRefs.current[audioKey];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(err => console.log('Audio play failed:', err));
    }
  };

  const percentage = Math.round((score / totalQuestions) * 100);

  const getEndingMessage = () => {
    if (percentage === 100) return "完璧です";
    if (percentage >= 90) return "素晴らしい結果です";
    if (percentage >= 80) return "よく頑張りました";
    if (percentage >= 70) return "良い調子です";
    if (percentage >= 60) return "お疲れ様でした";
    if (percentage >= 50) return "頑張りました";
    if (percentage >= 40) return "もう少しです";
    return "次回頑張りましょう";
  };

  // 目標設定: 前回最高得点が80%未満 => 80%が目標、80%以上 => 100%が目標
  const getTargetScore = () => {
    return personalBest < 80 ? 80 : 100;
  };

  const getMotivationalMessage = () => {
    if (totalQuestions === 0) return "問題がありませんでした。";
    
    if (isNewRecord && percentage > 50) {
      if (percentage === 100) return "🎉 完璧！新記録達成！";
      if (percentage >= 80) return "🚀 素晴らしい！新記録です！";
      if (percentage >= 60) return "🎯 新記録達成！よくできました！";
      return "📈 新記録！この調子で頑張ろう！";
    }
    
    if (percentage === 100) return "🎉 素晴らしい！全問正解です！";
    if (percentage >= 80) return "💪 すごい！あと少しで全問正解！";
    if (percentage >= 60) return "👍 よくできました！この調子で頑張ろう！";
    if (percentage >= 40) return "😊 ナイスチャレンジ！次はもっとできる！";
    return "✨ お疲れ様でした！続けて挑戦しよう！";
  };

  const getScoreColor = () => {
    if (percentage >= 90) return "from-yellow-400 to-orange-500";
    if (percentage >= 80) return "from-green-400 to-blue-500";
    if (percentage >= 60) return "from-blue-400 to-purple-500";
    if (percentage >= 40) return "from-purple-400 to-pink-500";
    return "from-gray-400 to-gray-500";
  };

  const getScoreIcon = () => {
    if (isNewRecord && percentage > 50) {
      return <div className="text-8xl mb-4 animate-bounce">🏆</div>;
    } else if (percentage === 100) {
      return <div className="text-8xl mb-4 animate-bounce">🎉</div>;
    } else if (percentage >= 80) {
      return <div className="text-8xl mb-4">🎊</div>;
    } else if (percentage >= 40) {
      return <div className="text-8xl mb-4">👏</div>;
    } else {
      return <div className="text-8xl mb-4">😢</div>;
    }
  };

  const getCardStyle = () => {
    if (percentage === 100) {
      // 100% - 金色に光る枠線 + 強い影 + より派手に
      return {
        border: '5px solid #FFD700',
        boxShadow: showEffect 
          ? '0 0 40px rgba(255, 215, 0, 1), 0 0 80px rgba(255, 215, 0, 0.6), 0 0 120px rgba(255, 215, 0, 0.3), 0 25px 50px rgba(0, 0, 0, 0.4)'
          : '0 0 25px rgba(255, 215, 0, 0.8), 0 15px 35px rgba(0, 0, 0, 0.25)',
        background: showEffect 
          ? 'linear-gradient(135deg, #FFF9E6 0%, #FFFBF0 25%, #FFFFFF 50%, #FFFBF0 75%, #FFF9E6 100%)'
          : 'linear-gradient(135deg, #FFF9E6 0%, #FFFFFF 100%)',
        animation: showEffect ? 'pulse-glow 1.5s infinite' : 'none',
        transform: showEffect ? 'scale(1.02)' : 'scale(1)'
      };
    } else if (percentage >= 80) {
      // 80-99% - 緑色に光る枠線
      return {
        border: '3px solid #10B981',
        boxShadow: showEffect 
          ? '0 0 25px rgba(16, 185, 129, 0.7), 0 0 50px rgba(16, 185, 129, 0.3), 0 15px 35px rgba(0, 0, 0, 0.2)'
          : '0 0 15px rgba(16, 185, 129, 0.5), 0 8px 25px rgba(0, 0, 0, 0.15)',
        background: showEffect 
          ? 'linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 50%, #ECFDF5 100%)'
          : 'white'
      };
    } else if (percentage >= 40) {
      // 40-79% - 青色に光る枠線
      return {
        border: '3px solid #3B82F6',
        boxShadow: showEffect 
          ? '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.2), 0 12px 30px rgba(0, 0, 0, 0.2)'
          : '0 0 12px rgba(59, 130, 246, 0.4), 0 6px 20px rgba(0, 0, 0, 0.1)',
        background: showEffect 
          ? 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 50%, #EFF6FF 100%)'
          : 'white'
      };
    } else {
      // 0-39% - 薄いグレーの枠線 + 励ましエフェクト
      return {
        border: showEffect ? '3px solid #9CA3AF' : '2px solid #D1D5DB',
        boxShadow: showEffect 
          ? '0 0 15px rgba(156, 163, 175, 0.4), 0 8px 25px rgba(0, 0, 0, 0.15)'
          : '0 4px 15px rgba(0, 0, 0, 0.1)',
        background: showEffect 
          ? 'linear-gradient(135deg, #F9FAFB 0%, #FFFFFF 50%, #F3F4F6 100%)'
          : 'white'
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-2 md:p-4">
      <div className="max-w-2xl mx-auto w-full">
        <div 
          className="rounded-2xl p-3 md:p-8 text-center transition-all duration-500"
          style={getCardStyle()}
        >
          {/* Icon and Title */}
          <div className="mb-4 md:mb-8">
            {getScoreIcon()}
            <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2" style={{ color: colors.crimsonColor }}>クイズ終了！</h2>
            <p className="text-base md:text-lg text-gray-600">{studentName}さん、{getEndingMessage()}！</p>
          </div>

          {/* Current Score */}
          <div className={`bg-gradient-to-r ${getScoreColor()} rounded-2xl p-4 md:p-8 text-white mb-4 md:mb-8`}>
            <div className="text-5xl md:text-6xl font-bold mb-1 md:mb-2">{percentage}%</div>
            <div className="text-lg md:text-xl opacity-90">
              {totalQuestions}問中 {score}問正解
            </div>
            {isNewRecord && percentage > 50 && (
              <div className="mt-3 bg-white bg-opacity-20 rounded-full px-4 py-2 inline-block">
                <span className="text-sm font-medium">🏆 新記録！</span>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-8">
            <div className="bg-green-50 rounded-xl p-2 md:p-4">
              <div className="text-xl md:text-2xl text-green-600 mb-1">✓</div>
              <div className="text-xl md:text-2xl font-bold text-green-800">{score}</div>
              <div className="text-xs md:text-sm text-green-600">正解</div>
            </div>
            <div className="bg-red-50 rounded-xl p-2 md:p-4">
              <div className="text-xl md:text-2xl text-red-600 mb-1">✗</div>
              <div className="text-xl md:text-2xl font-bold text-red-800">{totalQuestions - score}</div>
              <div className="text-xs md:text-sm text-red-600">不正解</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-2 md:p-4">
              <div className="text-xl md:text-2xl text-blue-600 mb-1">🏆</div>
              <div className="text-xl md:text-2xl font-bold text-blue-800">{personalBest}%</div>
              <div className="text-xs md:text-sm text-blue-600">自己ベスト</div>
            </div>
          </div>

          {/* Motivational Message */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-3 md:p-6 mb-4 md:mb-8">
            <p className="text-lg md:text-xl font-medium text-gray-800">
              {getMotivationalMessage()}
            </p>
          </div>

          {/* Personal Progress */}
          <div className="bg-gray-50 rounded-2xl p-3 md:p-6 mb-4 md:mb-8">
            <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-2 md:mb-4 text-center">📈 あなたの成長記録</h3>
            
            {/* Score comparison */}
            <div className="grid grid-cols-2 gap-2 md:gap-4 mb-3 md:mb-4">
              <div className="bg-white rounded-xl p-2 md:p-4 text-center border-2" style={{ borderColor: colors.newGoldColor }}>
                <div className="text-2xl md:text-3xl font-bold" style={{ color: colors.crimsonColor }}>{percentage}%</div>
                <div className="text-xs md:text-sm text-gray-600 font-medium">今回のスコア</div>
              </div>
              <div className="bg-white rounded-xl p-2 md:p-4 text-center border-2 border-blue-300">
                <div className="text-2xl md:text-3xl font-bold text-blue-600">{personalBest}%</div>
                <div className="text-xs md:text-sm text-gray-600 font-medium">自己ベスト記録</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="bg-white rounded-xl p-3 md:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">進歩状況</span>
                {percentage >= getTargetScore() && (
                  <span className="text-sm font-medium" style={{ color: colors.crimsonColor }}>
                    🎉 目標達成！
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="h-4 rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      width: `${percentage}%`,
                      background: `linear-gradient(to right, ${colors.newGoldColor}, ${colors.crimsonColor})`
                    }}
                  ></div>
                </div>
                {getTargetScore() > percentage && getTargetScore() <= 95 && (
                  <div 
                    className="absolute top-0 h-4 w-1 bg-blue-500 rounded"
                    style={{ left: `${getTargetScore()}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap">
                      目標: {getTargetScore()}%
                    </div>
                  </div>
                )}
                {getTargetScore() > percentage && getTargetScore() > 95 && (
                  <div className="absolute -top-6 right-0 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    目標: {getTargetScore()}%
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
              {percentage < getTargetScore() && (
                <div className="text-center mt-3">
                  <span className="text-sm font-medium" style={{ color: colors.crimsonColor }}>
                    あと{getTargetScore() - percentage}%で目標達成
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={onRestart}
            variant="contained"
            sx={{
              backgroundColor: colors.newGoldColor,
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              textTransform: 'none',
              borderRadius: '12px',
              padding: '16px 32px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: colors.newGoldColor,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                transform: 'scale(1.05)',
              }
            }}
          >
            <span className="flex items-center justify-center space-x-2">
              <span>🚀</span>
              <span>もう一度挑戦する</span>
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};