import React from 'react';
import { colors } from '../../config/colors';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = '読み込み中...', 
  subMessage = 'しばらくお待ちください。' 
}) => {
  const { newGoldColor, crimsonColor } = colors;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-4 text-center bg-white">
      <div 
        className="animate-spin rounded-full h-12 w-12 border-b-4 mb-4"
        style={{ borderColor: newGoldColor }}
      />
      <p className="text-xl font-medium" style={{ color: crimsonColor }}>
        {message}
      </p>
      <p className="text-gray-500">
        {subMessage}
      </p>
    </div>
  );
};