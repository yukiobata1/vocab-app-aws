import React from 'react';
import { colors } from '../../config/colors';

interface LessonRangeSelectorProps {
  lessonStart: number | string;
  lessonEnd: number | string;
  onLessonStartChange: (value: number) => void;
  onLessonEndChange: (value: number) => void;
  disabled?: boolean;
  useStringState?: boolean; // For StudentWaitingRoom compatibility
  onStringChange?: (value: string, type: 'start' | 'end') => void;
}

export const LessonRangeSelector: React.FC<LessonRangeSelectorProps> = ({
  lessonStart,
  lessonEnd,
  onLessonStartChange,
  onLessonEndChange,
  disabled = false,
  useStringState = false,
  onStringChange
}) => {
  const { crimsonColor } = colors;

  const handleNumberChange = (value: string, type: 'start' | 'end') => {
    if (useStringState && onStringChange) {
      // For StudentWaitingRoom - handle string state
      if (/^\d*$/.test(value)) {
        const cleanValue = value.replace(/^0+/, '') || (value === '' ? '' : '0');
        onStringChange(cleanValue, type);
      }
    } else {
      // For TeacherConfig - handle number state
      const numValue = Number(value);
      if (type === 'start') {
        onLessonStartChange(numValue);
      } else {
        onLessonEndChange(numValue);
      }
    }
  };

  return (
    <div className="col-span-1 md:col-span-2">
      <div className="grid grid-cols-2 gap-2 md:gap-4">
        <div>
          <label htmlFor="lessonStartInput" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
            開始課
          </label>
          <input
            id="lessonStartInput"
            type={useStringState ? "text" : "number"}
            inputMode="numeric"
            min="1"
            placeholder="1"
            value={lessonStart}
            onChange={(e) => handleNumberChange(e.target.value, 'start')}
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
            disabled={disabled}
            required={!useStringState}
          />
        </div>
        <div>
          <label htmlFor="lessonEndInput" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
            終了課
          </label>
          <input
            id="lessonEndInput"
            type={useStringState ? "text" : "number"}
            inputMode="numeric"
            min="1"
            placeholder="5"
            value={lessonEnd}
            onChange={(e) => handleNumberChange(e.target.value, 'end')}
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
            disabled={disabled}
            required={!useStringState}
          />
        </div>
      </div>
    </div>
  );
};