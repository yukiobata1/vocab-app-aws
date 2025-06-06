import React from 'react';
import { colors } from '../../config/colors';

interface QuestionCountSelectorProps {
  questionCount: number | string;
  onQuestionCountChange: (value: number) => void;
  disabled?: boolean;
  maxQuestions?: number;
  useStringState?: boolean; // For StudentWaitingRoom compatibility
  onStringChange?: (value: string) => void;
}

export const QuestionCountSelector: React.FC<QuestionCountSelectorProps> = ({
  questionCount,
  onQuestionCountChange,
  disabled = false,
  maxQuestions = 50,
  useStringState = false,
  onStringChange
}) => {
  const { crimsonColor } = colors;

  const handleChange = (value: string) => {
    if (useStringState && onStringChange) {
      // For StudentWaitingRoom - handle string state
      if (/^\d*$/.test(value)) {
        const cleanValue = value.replace(/^0+/, '') || (value === '' ? '' : '0');
        onStringChange(cleanValue);
      }
    } else {
      // For TeacherConfig - handle number state
      const numValue = Number(value);
      onQuestionCountChange(numValue);
    }
  };

  return (
    <div className="md:col-span-2">
      <label htmlFor="questionCountInput" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
        出題数 (最大{maxQuestions}問)
      </label>
      <input
        id="questionCountInput"
        type={useStringState ? "text" : "number"}
        inputMode="numeric"
        min="1"
        max={maxQuestions}
        placeholder="10"
        value={questionCount}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
        disabled={disabled}
        required={!useStringState}
      />
    </div>
  );
};