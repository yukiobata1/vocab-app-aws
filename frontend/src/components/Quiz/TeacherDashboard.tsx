'use client';

import React, { useState, useEffect } from 'react';
import { TeacherConfig } from './TeacherConfig';
import type { QuizConfig, QuizQuestion } from '../../types/quiz';
import { generateQuiz } from '../../utils/quizGenerator';
import { vocabService } from '../../services/vocabService';
import { roomCodeService } from '../../services/roomCodeService';
import { Button } from '@/components/ui/button';
import { QUESTION_TYPE_CONFIGS } from '../../types/quiz';
import { colors } from '@/config/colors';
import QRCode from 'qrcode';
import { LoadingScreen } from '../common/LoadingScreen';

type TeacherState = 'config' | 'generating' | 'active' | 'error';

export const TeacherDashboard: React.FC = () => {
  const [state, setState] = useState<TeacherState>('config');
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // Generate QR code when room code changes
  useEffect(() => {
    if (roomCode) {
      const studentUrl = `${window.location.origin}?room=${roomCode}`;
      QRCode.toDataURL(studentUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('Failed to generate QR code:', err));
    }
  }, [roomCode]);

  // Helper function to get question type display name
  const getQuestionTypeDisplayName = (questionType: string): string => {
    const config = QUESTION_TYPE_CONFIGS[questionType as keyof typeof QUESTION_TYPE_CONFIGS];
    return config ? config.name : questionType;
  };

  // Helper function to get quiz format display name from format object
  const getQuizFormatDisplayName = (format?: { input1: string; input2?: string; output: string }): string => {
    if (!format) {
      return '';
    }
    
    if (format.input2) {
      return `${format.input1}+${format.input2} → ${format.output}`;
    } else {
      return `${format.input1} → ${format.output}`;
    }
  };

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
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.log('Failed to copy room code:', err);
    }
  };

  const generateNewRoom = () => {
    if (quizConfig) {
      handleConfigSubmit(quizConfig);
    }
  };

  const { newGoldColor, crimsonColor } = colors;

  const renderContent = () => {
    switch (state) {
      case 'config':
        return <TeacherConfig onConfigSubmit={handleConfigSubmit} />;

      case 'generating':
        return (
          <LoadingScreen 
            message="クイズルームを作成中..."
            subMessage="問題を生成してコードを発行しています"
          />
        );

      case 'active':
        return (
          <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
              {/* Header */}
              <div className="text-center mb-4 md:mb-8">
                <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-4" style={{ color: crimsonColor }}>
                  👨‍🏫 クイズルーム開始中
                </h1>
                <p className="text-base md:text-xl text-gray-600">
                  以下のコードを学生に教えてください
                </p>
              </div>

              {/* Main Card with QR Code and Room Code */}
              <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl p-6 md:p-12 text-center">
                {/* QR Code Display - Now at the top */}
                {qrCodeUrl && (
                  <div className="mb-4 md:mb-6">
                    <div className="text-sm md:text-base font-medium text-gray-700 mb-2 text-center">
                      📱 学生はこのQRコードをスキャンできます
                    </div>
                    <div className="flex justify-center">
                      <img 
                        src={qrCodeUrl} 
                        alt="Room QR Code" 
                        className="rounded-lg shadow-lg border-2 border-gray-200"
                        style={{ width: '300px', height: '300px' }}
                      />
                    </div>
                  </div>
                )}

                {/* Room Code Display */}
                <div 
                  className="rounded-xl md:rounded-2xl p-4 md:p-8 mb-4 md:mb-8 border-4 cursor-pointer hover:opacity-90 transition-opacity duration-200" 
                  style={{ backgroundColor: newGoldColor, borderColor: crimsonColor }}
                  onClick={copyRoomCode}
                  title="クリックでコピー"
                >
                  <div className="text-white text-center">
                    <div className="text-xs md:text-sm mb-1 md:mb-2" style={{ color: 'white' }}>
                      {isCopied ? '✅ コピーしました' : 'クイズコードをコピー'}
                    </div>
                    <div className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold tracking-wider" style={{ color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
                      {roomCode}
                    </div>
                  </div>
                </div>

                {/* Room Info */}
                <div className="rounded-lg md:rounded-xl p-3 md:p-4 mb-4 md:mb-6 border border-gray-200" style={{ backgroundColor: '#FFFBEB' }}>
                  <p className="text-xs md:text-sm text-gray-700">
                    有効期限: {expiresAt ? new Date(expiresAt).toLocaleString('ja-JP') : '24時間'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    このコードは24時間後に自動的に無効になります
                  </p>
                </div>

                {/* Action Buttons - Mobile Optimized */}
                <div className="flex flex-col gap-3 md:flex-row md:gap-4 justify-center">
                  <Button
                    onClick={copyRoomCode}
                    className="text-white font-bold py-3 px-4 md:px-6 rounded-lg md:rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 touch-manipulation shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                    style={{ backgroundColor: newGoldColor }}
                  >
                    <span>{isCopied ? '✅' : '📋'}</span>
                    <span className="text-sm md:text-base">{isCopied ? 'コピーしました' : 'コードをコピー'}</span>
                  </Button>
                  
                  <Button
                    onClick={generateNewRoom}
                    className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold py-3 px-4 md:px-6 rounded-lg md:rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 touch-manipulation"
                  >
                    <span>🔄</span>
                    <span className="text-sm md:text-base">新しいコード生成</span>
                  </Button>
                  
                  <Button
                    onClick={stopQuiz}
                    className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold py-3 px-4 md:px-6 rounded-lg md:rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 touch-manipulation"
                  >
                    <span>⏹️</span>
                    <span className="text-sm md:text-base">ルームを終了</span>
                  </Button>
                </div>
              </div>

              {/* Instructions - Mobile Optimized */}
              <div className="bg-white rounded-xl md:rounded-2xl shadow-lg p-4 md:p-8">
                <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4" style={{ color: crimsonColor }}>📋 手順</h3>
                <div className="space-y-2 md:space-y-3 text-gray-600">
                  <div className="flex items-start space-x-2 md:space-x-3">
                    <span className="text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0" style={{ backgroundColor: newGoldColor }}>1</span>
                    <span className="text-sm md:text-base">上のQRコードまたは6桁コードを黒板やプロジェクターで学生に見せてください</span>
                  </div>
                  <div className="flex items-start space-x-2 md:space-x-3">
                    <span className="text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0" style={{ backgroundColor: newGoldColor }}>2</span>
                    <span className="text-sm md:text-base">学生はQRコードをスキャンするか、「学生用」→「教室テスト」でコードを入力します</span>
                  </div>
                  <div className="flex items-start space-x-2 md:space-x-3">
                    <span className="text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0" style={{ backgroundColor: newGoldColor }}>3</span>
                    <span className="text-sm md:text-base">学生がクイズを開始します</span>
                  </div>
                  <div className="flex items-start space-x-2 md:space-x-3">
                    <span className="text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0" style={{ backgroundColor: newGoldColor }}>4</span>
                    <span className="text-sm md:text-base">終了したら「ルームを終了」で新しいクイズを設定できます</span>
                  </div>
                </div>
              </div>

              {/* Quiz Config Summary - Now at the bottom */}
              <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">                
                <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4" style={{ color: crimsonColor }}>📚 クイズ設定</h3>
                {quizConfig && (
                  <div className="grid grid-cols-2 gap-2 md:gap-4 text-center">
                    <div className="rounded-lg p-2 md:p-3 border border-gray-200" style={{ backgroundColor: '#FFFBEB' }}>
                      <div className="text-xs md:text-sm" style={{ color: crimsonColor }}>教材</div>
                      <div className="text-sm md:text-base font-bold text-gray-800 truncate">{quizConfig.bookTitle}</div>
                    </div>
                    <div className="rounded-lg p-2 md:p-3 border border-gray-200" style={{ backgroundColor: '#FFFBEB' }}>
                      <div className="text-xs md:text-sm" style={{ color: crimsonColor }}>範囲</div>
                      <div className="text-sm md:text-base font-bold text-gray-800">課{quizConfig.lessonRange.start}-{quizConfig.lessonRange.end}</div>
                    </div>
                    <div className="rounded-lg p-2 md:p-3 border border-gray-200" style={{ backgroundColor: '#FFFBEB' }}>
                      <div className="text-xs md:text-sm" style={{ color: crimsonColor }}>問題数</div>
                      <div className="text-sm md:text-base font-bold text-gray-800">{quizConfig.questionCount}問</div>
                    </div>
                    <div className="rounded-lg p-2 md:p-3 border border-gray-200 col-span-2" style={{ backgroundColor: '#FFFBEB' }}>
                      <div className="text-xs md:text-sm" style={{ color: crimsonColor }}>出題形式</div>
                      <div className="text-sm md:text-base font-bold text-gray-800 truncate">
                        {quizConfig.quizFormat ? 
                          getQuizFormatDisplayName(quizConfig.quizFormat) : 
                          getQuestionTypeDisplayName(quizConfig.enabledQuestionTypes[0])
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-red-50 flex items-center justify-center p-4">
            <div className="max-w-md mx-auto w-full">
              <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl p-6 md:p-8 text-center">
                <div className="text-5xl md:text-6xl mb-3 md:mb-4">⚠️</div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3 md:mb-4">エラーが発生しました</h2>
                <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6">{error}</p>
                <Button
                  onClick={() => setState('config')}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg md:rounded-2xl transition-all duration-200 transform hover:scale-105 touch-manipulation w-full md:w-auto"
                >
                  設定に戻る
                </Button>
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