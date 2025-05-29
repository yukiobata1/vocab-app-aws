import React, { useEffect, useState } from 'react';
import { ScoreManager } from '../../utils/scoreManager';

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

  useEffect(() => {
    // Save current score
    ScoreManager.saveScore(score, totalQuestions, studentName);
    
    // Get personal best
    const personalBestRecord = ScoreManager.getPersonalBest(studentName);
    
    const currentPercentage = Math.round((score / totalQuestions) * 100);
    
    if (personalBestRecord) {
      setPersonalBest(personalBestRecord.percentage);
      setIsNewRecord(currentPercentage >= personalBestRecord.percentage);
    } else {
      setPersonalBest(currentPercentage);
      setIsNewRecord(true);
    }
  }, [score, totalQuestions, studentName]);

  const percentage = Math.round((score / totalQuestions) * 100);

  const getMotivationalMessage = () => {
    if (totalQuestions === 0) return "問題がありませんでした。";
    
    if (isNewRecord && percentage > 0) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center">
          {/* Icon and Title */}
          <div className="mb-8">
            {isNewRecord && percentage > 0 ? (
              <div className="text-8xl mb-4 animate-bounce">🏆</div>
            ) : percentage >= 80 ? (
              <div className="text-8xl mb-4">🎉</div>
            ) : percentage >= 60 ? (
              <div className="text-8xl mb-4">👏</div>
            ) : (
              <div className="text-8xl mb-4">📚</div>
            )}
            <h2 className="text-4xl font-bold text-gray-800 mb-2">クイズ終了！</h2>
            <p className="text-xl text-gray-600">{studentName}さん、お疲れ様でした！</p>
          </div>

          {/* Current Score */}
          <div className={`bg-gradient-to-r ${getScoreColor()} rounded-2xl p-8 text-white mb-8`}>
            <div className="text-6xl font-bold mb-2">{percentage}%</div>
            <div className="text-xl opacity-90">
              {totalQuestions}問中 {score}問正解
            </div>
            {isNewRecord && percentage > 0 && (
              <div className="mt-3 bg-white bg-opacity-20 rounded-full px-4 py-2 inline-block">
                <span className="text-sm font-medium">🏆 新記録！</span>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-2xl text-green-600 mb-1">✓</div>
              <div className="text-2xl font-bold text-green-800">{score}</div>
              <div className="text-sm text-green-600">正解</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-2xl text-red-600 mb-1">✗</div>
              <div className="text-2xl font-bold text-red-800">{totalQuestions - score}</div>
              <div className="text-sm text-red-600">不正解</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-2xl text-blue-600 mb-1">🏆</div>
              <div className="text-2xl font-bold text-blue-800">{personalBest}%</div>
              <div className="text-sm text-blue-600">自己ベスト</div>
            </div>
          </div>

          {/* Motivational Message */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-8">
            <p className="text-xl font-medium text-gray-800">
              {getMotivationalMessage()}
            </p>
          </div>

          {/* Personal Progress */}
          <div className="bg-gray-50 rounded-2xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">あなたの成長</h3>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{percentage}%</div>
                <div className="text-sm text-gray-500">今回</div>
              </div>
              <div className="flex-1 mx-4">
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${(percentage / 100) * 100}%` }}
                    ></div>
                  </div>
                  {personalBest > percentage && (
                    <div 
                      className="absolute top-0 h-3 w-1 bg-blue-500"
                      style={{ left: `${personalBest}%` }}
                      title={`自己ベスト: ${personalBest}%`}
                    >
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-600 font-medium">
                        目標
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{personalBest}%</div>
                <div className="text-sm text-gray-500">ベスト</div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onRestart}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <span className="flex items-center justify-center space-x-2">
              <span>🚀</span>
              <span>もう一度挑戦する</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};