import React, { useMemo } from 'react';
import { colors } from '../../config/colors';
import { QuestionType, type VocabQuestion } from '../../types/quiz';
import { detectAvailableFields, isQuestionTypeCompatible } from '../../utils/fieldDetection';

interface FieldAwareQuizFormatSelectorProps {
  value: {
    input1: string;
    input2: string | undefined;
    output: string;
  };
  onChange: (format: { input1: string; input2: string | undefined; output: string }) => void;
  allowMultipleInputs?: boolean;
  vocabularyQuestions?: VocabQuestion[]; // Questions to analyze for field availability
  showUnavailableOptions?: boolean; // Show unavailable options as disabled
}

// Map UI format strings to required fields
const formatFieldMap: Record<string, keyof VocabQuestion> = {
  'ネパール語': 'np1',
  '漢字': 'jp_kanji',
  '読み': 'jp_rubi',
  '文脈': 'japanese_question'
};

export const FieldAwareQuizFormatSelector: React.FC<FieldAwareQuizFormatSelectorProps> = ({
  value,
  onChange,
  allowMultipleInputs = false,
  vocabularyQuestions = [],
  showUnavailableOptions = true
}) => {
  const availableFields = useMemo(() => {
    if (vocabularyQuestions.length === 0) {
      // If no questions provided, assume all fields are available
      return new Set<keyof VocabQuestion>(['np1', 'jp_kanji', 'jp_rubi', 'japanese_question']);
    }
    return detectAvailableFields(vocabularyQuestions);
  }, [vocabularyQuestions]);


  // Check if a format option is available
  const isFormatAvailable = (format: string): boolean => {
    const requiredField = formatFieldMap[format];
    return requiredField ? availableFields.has(requiredField) : true;
  };

  // Get available format options
  const getAvailableFormatOptions = (): string[] => {
    const allOptions = ['ネパール語', '漢字', '読み', '文脈'];
    if (showUnavailableOptions) {
      return allOptions; // Return all, we'll disable unavailable ones
    }
    return allOptions.filter(isFormatAvailable);
  };

  // Check if the current combination would result in a compatible question type
  const isCurrentCombinationValid = (): boolean => {
    const questionType = getQuestionTypeFromFormat(value.input1, value.output, value.input2);
    return isQuestionTypeCompatible(questionType, availableFields);
  };

  const formatOptions = getAvailableFormatOptions();

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

  const renderOption = (option: string) => {
    const isAvailable = isFormatAvailable(option);
    return (
      <option 
        key={option} 
        value={option}
        disabled={!isAvailable}
        style={{ 
          color: isAvailable ? 'inherit' : '#999',
          fontStyle: isAvailable ? 'normal' : 'italic'
        }}
      >
        {option}{!isAvailable ? ' (利用不可)' : ''}
      </option>
    );
  };

  // Warning message if current combination is invalid
  const showWarning = vocabularyQuestions.length > 0 && !isCurrentCombinationValid();

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium mb-1" style={{ color: colors.crimsonColor }}>
        出題形式
      </label>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center sm:space-x-2 space-y-2 sm:space-y-0 p-4 bg-gray-50 rounded-md">
        {/* First input */}
        <select
          value={value.input1}
          onChange={(e) => handleInput1Change(e.target.value)}
          className="p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500 min-w-0 flex-shrink"
        >
          {formatOptions.map((option) => renderOption(option))}
        </select>

        {/* Optional second input */}
        {allowMultipleInputs && (
          <>
            <div className="flex items-center justify-center">
              <span className="text-gray-400 text-sm sm:hidden">+</span>
              <span className="text-gray-400 text-sm self-center hidden sm:inline">+</span>
            </div>
            <select
              value={value.input2 || 'なし'}
              onChange={(e) => handleInput2Change(e.target.value)}
              className="p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500 min-w-0 flex-shrink"
            >
              <option value="なし">なし</option>
              {formatOptions.filter(option => option !== value.input1).map((option) => 
                renderOption(option)
              )}
            </select>
          </>
        )}

        <div className="flex items-center justify-center">
          <span className="text-gray-400 text-lg sm:hidden">↓</span>
          <span className="text-gray-400 text-lg self-center hidden sm:inline">→</span>
        </div>

        {/* Output */}
        <select
          value={value.output}
          onChange={(e) => handleOutputChange(e.target.value)}
          className="p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500 min-w-0 flex-shrink"
        >
          {formatOptions.filter(option => option !== '文脈').map((option) => 
            renderOption(option)
          )}
        </select>
      </div>
      
      {/* Warning message */}
      {showWarning && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ この単語帳では選択された出題形式に必要なデータが不足しています。
            利用可能な形式を選択してください。
          </p>
        </div>
      )}

    </div>
  );
};

// Helper function to convert format to QuestionType (same as original)
export const getQuestionTypeFromFormat = (
  input1: string,
  output: string,
  input2?: string
): QuestionType => {
  // Handle compound formats (with two inputs)
  if (input2) {
    // 文脈 + ネパール語 combinations
    if ((input1 === '文脈' || input2 === '文脈') && 
        (input1 === 'ネパール語' || input2 === 'ネパール語')) {
      if (output === '漢字') return QuestionType.FILL_IN_BLANK_NEPALI_TO_KANJI;
      if (output === '読み') return QuestionType.FILL_IN_BLANK_NEPALI_TO_RUBI;
    }
    // 文脈 + 漢字 combinations
    if ((input1 === '文脈' || input2 === '文脈') && 
        (input1 === '漢字' || input2 === '漢字')) {
      if (output === 'ネパール語') return QuestionType.FILL_IN_BLANK_KANJI_TO_NEPALI;
      if (output === '読み') return QuestionType.FILL_IN_BLANK_KANJI_TO_RUBI;
    }
    // 文脈 + 読み combinations
    if ((input1 === '文脈' || input2 === '文脈') && 
        (input1 === '読み' || input2 === '読み')) {
      if (output === 'ネパール語') return QuestionType.FILL_IN_BLANK_RUBI_TO_NEPALI;
      if (output === '漢字') return QuestionType.FILL_IN_BLANK_RUBI_TO_KANJI;
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
  if (input1 === '文脈' && output === '読み') return QuestionType.FILL_IN_BLANK_TO_RUBI;
  if (input1 === '文脈' && output === 'ネパール語') return QuestionType.FILL_IN_BLANK_TO_NEPALI;

  return QuestionType.NEPALI_TO_KANJI; // Default fallback
};