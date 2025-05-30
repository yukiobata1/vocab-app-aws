import React from 'react';
import { colors } from '../../config/colors';
import { QuestionType } from '../../types/quiz';

interface QuizFormatSelectorProps {
  value: {
    input1: string;
    input2?: string;
    output: string;
  };
  onChange: (format: { input1: string; input2?: string; output: string }) => void;
  allowMultipleInputs?: boolean;
}

export const QuizFormatSelector: React.FC<QuizFormatSelectorProps> = ({
  value,
  onChange,
  allowMultipleInputs = false
}) => {
  const formatOptions = ['ネパール語', '漢字', '読み', '文脈'];

  const handleInput1Change = (newInput1: string) => {
    onChange({
      input1: newInput1,
      input2: value.input2,
      output: value.output
    });
  };

  const handleInput2Change = (newInput2: string) => {
    onChange({
      input1: value.input1,
      input2: newInput2 === 'なし' ? undefined : newInput2,
      output: value.output
    });
  };

  const handleOutputChange = (newOutput: string) => {
    onChange({
      input1: value.input1,
      input2: value.input2,
      output: newOutput
    });
  };

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium mb-1" style={{ color: colors.crimsonColor }}>
        出題形式
      </label>
      <div className="flex items-center justify-center space-x-2 p-4 bg-gray-50 rounded-md">
        {/* First input */}
        <select
          value={value.input1}
          onChange={(e) => handleInput1Change(e.target.value)}
          className="p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
        >
          {formatOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        {/* Optional second input */}
        {allowMultipleInputs && (
          <>
            <span className="text-gray-400 text-sm">+</span>
            <select
              value={value.input2 || 'なし'}
              onChange={(e) => handleInput2Change(e.target.value)}
              className="p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
            >
              <option value="なし">なし</option>
              {formatOptions.filter(option => option !== value.input1).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        )}

        <span className="text-gray-400 text-lg">→</span>

        {/* Output */}
        <select
          value={value.output}
          onChange={(e) => handleOutputChange(e.target.value)}
          className="p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
        >
          {formatOptions.filter(option => option !== '文脈').map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

// Helper function to convert format to QuestionType
export const getQuestionTypeFromFormat = (
  input1: string,
  input2: string | undefined,
  output: string
): QuestionType => {
  // Handle compound formats (with two inputs)
  if (input2) {
    if ((input1 === '文脈' || input2 === '文脈') && 
        (input1 === 'ネパール語' || input2 === 'ネパール語')) {
      if (output === '漢字') return QuestionType.FILL_IN_BLANK_NEPALI_TO_KANJI;
      if (output === '読み') return QuestionType.FILL_IN_BLANK_NEPALI_TO_RUBI;
    }
  }

  // Handle single input formats
  if (input1 === 'ネパール語' && output === '漢字') return QuestionType.NEPALI_TO_KANJI;
  if (input1 === 'ネパール語' && output === '読み') return QuestionType.NEPALI_TO_RUBI;
  if (input1 === '漢字' && output === '読み') return QuestionType.KANJI_TO_RUBI;
  if (input1 === '読み' && output === '漢字') return QuestionType.RUBI_TO_KANJI;
  if (input1 === '漢字' && output === 'ネパール語') return QuestionType.KANJI_TO_NEPALI;
  if (input1 === '読み' && output === 'ネパール語') return QuestionType.RUBI_TO_NEPALI;
  if (input1 === '文脈' && output === '漢字') return QuestionType.FILL_IN_BLANK;

  return QuestionType.NEPALI_TO_KANJI; // Default fallback
};

// Helper function to convert QuestionType back to format
export const getFormatFromQuestionType = (
  questionType: QuestionType
): { input1: string; input2?: string; output: string } => {
  switch (questionType) {
    case QuestionType.NEPALI_TO_KANJI:
      return { input1: 'ネパール語', output: '漢字' };
    case QuestionType.NEPALI_TO_RUBI:
      return { input1: 'ネパール語', output: '読み' };
    case QuestionType.KANJI_TO_RUBI:
      return { input1: '漢字', output: '読み' };
    case QuestionType.RUBI_TO_KANJI:
      return { input1: '読み', output: '漢字' };
    case QuestionType.KANJI_TO_NEPALI:
      return { input1: '漢字', output: 'ネパール語' };
    case QuestionType.RUBI_TO_NEPALI:
      return { input1: '読み', output: 'ネパール語' };
    case QuestionType.FILL_IN_BLANK:
      return { input1: '文脈', output: '漢字' };
    case QuestionType.FILL_IN_BLANK_NEPALI_TO_KANJI:
      return { input1: '文脈', input2: 'ネパール語', output: '漢字' };
    case QuestionType.FILL_IN_BLANK_NEPALI_TO_RUBI:
      return { input1: '文脈', input2: 'ネパール語', output: '読み' };
    default:
      return { input1: 'ネパール語', output: '漢字' };
  }
};