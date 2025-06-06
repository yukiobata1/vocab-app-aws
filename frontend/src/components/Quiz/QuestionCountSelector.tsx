import React from 'react';
import { TextField } from '@mui/material';
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
      <TextField
        label={`出題数 (最大${maxQuestions}問)`}
        type={useStringState ? "text" : "number"}
        inputProps={{ 
          inputMode: "numeric",
          min: "1",
          max: maxQuestions
        }}
        placeholder="10"
        value={questionCount}
        onChange={(e) => handleChange(e.target.value)}
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
  );
};