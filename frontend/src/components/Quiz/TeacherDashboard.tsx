import React, { useState } from 'react';
import { TeacherConfig } from './TeacherConfig';
import type { QuizConfig, QuizQuestion } from '../../types/quiz';
import { generateQuiz } from '../../utils/quizGenerator';
import { vocabService } from '../../services/vocabService';
import { roomCodeService } from '../../services/roomCodeService';

type TeacherState = 'config' | 'generating' | 'active' | 'error';

export const TeacherDashboard: React.FC = () => {
  const [state, setState] = useState<TeacherState>('config');
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleConfigSubmit = async (config: QuizConfig) => {
    setState('generating');
    setError(null);
    
    try {
      // Fetch vocabulary data
      const response = await vocabService.getQuestions(config.bookId);
      if (!response.questions) {
        throw new Error('語彙データの取得に失敗しました');
      }
      
      // Filter questions by lesson range
      const filteredQuestions = response.questions.filter(
        q => q.ka >= config.lessonRange.start && q.ka <= config.lessonRange.end
      );

      if (filteredQuestions.length === 0) {
        throw new Error('指定された範囲に問題が見つかりませんでした');
      }

      // Generate quiz questions
      const generatedQuiz = generateQuiz(filteredQuestions, config);
      const questions = generatedQuiz.questions.map(q => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        correctAnswer: q.correctAnswer,
        options: q.options
      }));

      // Create room in DynamoDB
      const roomResponse = await roomCodeService.createRoom(
        config,
        questions,
        'guest' // Guest teacher for now
      );

      setQuizConfig(config);
      setQuizQuestions(questions);
      setRoomCode(roomResponse.roomCode);
      setExpiresAt(roomResponse.expiresAt);
      setState('active');
    } catch (err) {
      console.error('Failed to create quiz room:', err);
      setError(err instanceof Error ? err.message : 'クイズルームの作成に失敗しました');
      setState('error');
    }
  };

  const stopQuiz = async () => {
    if (roomCode) {
      try {
        await roomCodeService.deleteRoom(roomCode, 'guest');
      } catch (err) {
        console.error('Failed to delete room:', err);
      }
    }
    setState('config');
    setQuizConfig(null);
    setRoomCode('');
    setQuizQuestions([]);
    setExpiresAt('');
    setError(null);
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch (err) {
      console.log('Failed to copy room code:', err);
    }
  };

  const generateNewRoom = () => {
    if (quizConfig) {
      handleConfigSubmit(quizConfig);
    }
  };

  const renderContent = () => {
    switch (state) {
      case 'config':
        return <TeacherConfig onConfigSubmit={handleConfigSubmit} />;

      case 'generating':
        return (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-6"></div>
              <div className="text-2xl font-medium text-gray-700 mb-2">
                クイズルームを作成中...
              </div>
              <div className="text-gray-500">
                問題を生成してDynamoDBに保存しています
              </div>
            </div>
          </div>
        );

      case 'active':
        return (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">
                  👨‍🏫 クイズルーム開始中
                </h1>
                <p className="text-xl text-gray-600">
                  以下のコードを生徒に教えてください
                </p>
              </div>

              {/* Quiz Config Summary */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📚 クイズ設定</h3>
                {quizConfig && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-sm text-blue-600">教材</div>
                      <div className="font-bold text-blue-800">{quizConfig.bookTitle}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-sm text-green-600">範囲</div>
                      <div className="font-bold text-green-800">課{quizConfig.lessonRange.start}-{quizConfig.lessonRange.end}</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-sm text-purple-600">問題数</div>
                      <div className="font-bold text-purple-800">{quizConfig.questionCount}問</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <div className="text-sm text-orange-600">出題形式</div>
                      <div className="font-bold text-orange-800">{quizConfig.enabledQuestionTypes.length}種類</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Room Code Display */}
              <div className="bg-white rounded-3xl shadow-2xl p-12 text-center">
                <div className="bg-gradient-to-r from-green-400 to-blue-500 rounded-2xl p-8 mb-8">
                  <div className="text-white text-center">
                    <div className="text-sm opacity-90 mb-2">クイズコード</div>
                    <div className="text-8xl font-mono font-bold tracking-wider">
                      {roomCode}
                    </div>
                  </div>
                </div>

                {/* Room Info */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-sm text-gray-600">
                    有効期限: {expiresAt ? new Date(expiresAt).toLocaleString('ja-JP') : '24時間'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    このコードは24時間後に自動的に無効になります
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={copyRoomCode}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <span>📋</span>
                    <span>コードをコピー</span>
                  </button>
                  
                  <button
                    onClick={generateNewRoom}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <span>🔄</span>
                    <span>新しいコード生成</span>
                  </button>
                  
                  <button
                    onClick={stopQuiz}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <span>⏹️</span>
                    <span>ルームを終了</span>
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">📋 手順</h3>
                <div className="space-y-3 text-gray-600">
                  <div className="flex items-start space-x-3">
                    <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                    <span>上の6桁コードを黒板やプロジェクターで生徒に見せてください</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                    <span>生徒に「生徒用」→「教室テスト」モードでアプリを開いてもらいます</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                    <span>生徒がコードを入力してクイズを開始します</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
                    <span>終了したら「ルームを終了」で新しいクイズを設定できます</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-red-50 flex items-center justify-center p-4">
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">エラーが発生しました</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => setState('config')}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-200 transform hover:scale-105"
                >
                  設定に戻る
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return renderContent();
};