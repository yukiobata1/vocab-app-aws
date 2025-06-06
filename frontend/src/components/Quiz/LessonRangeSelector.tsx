import React from 'react';
import { TextField } from '@mui/material';
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
        <TextField
          label="開始課"
          type={useStringState ? "text" : "number"}
          inputProps={{ 
            inputMode: "numeric",
            min: "1"
          }}
          placeholder="1"
          value={lessonStart}
          onChange={(e) => handleNumberChange(e.target.value, 'start')}
          disabled={disabled}
          required={!useStringState}
          fullWidth
          sx={{
            '& .MuiInputLabel-root': {
              color: crimsonColor,
              '&.Mui-focused': {
                color: crimsonColor,
              }
            },
            '& .MuiOutlinedInput-root': {
              borderRadius: '6px',
              '& fieldset': {
                borderColor: '#D1D5DB',
              },
              '&:hover fieldset': {
                borderColor: '#9CA3AF',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#9CA3AF',
              }
            }
          }}
        />
        
        <TextField
          label="終了課"
          type={useStringState ? "text" : "number"}
          inputProps={{ 
            inputMode: "numeric",
            min: "1"
          }}
          placeholder="5"
          value={lessonEnd}
          onChange={(e) => handleNumberChange(e.target.value, 'end')}
          disabled={disabled}
          required={!useStringState}
          fullWidth
          sx={{
            '& .MuiInputLabel-root': {
              color: crimsonColor,
              '&.Mui-focused': {
                color: crimsonColor,
              }
            },
            '& .MuiOutlinedInput-root': {
              borderRadius: '6px',
              '& fieldset': {
                borderColor: '#D1D5DB',
              },
              '&:hover fieldset': {
                borderColor: '#9CA3AF',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#9CA3AF',
              }
            }
          }}
        />
      </div>
    </div>
  );
};