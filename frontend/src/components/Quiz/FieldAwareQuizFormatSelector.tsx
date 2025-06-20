import React, { useMemo } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { colors } from '../../config/colors';
import { QuestionType, type VocabQuestion } from '../../types/quiz';
import { detectAvailableFields, isQuestionTypeCompatible, isCompoundFormatCompatible } from '../../utils/fieldDetection';

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
    // For compound formats, use the dedicated compatibility check
    if (value.input2 && value.input2 !== 'なし') {
      const inputs = [value.input1, value.input2];
      return isCompoundFormatCompatible(inputs, value.output, availableFields);
    }
    
    // For single input formats, use the existing logic
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

  // renderOption function moved inline to select elements

  // Warning message if current combination is invalid
  const showWarning = vocabularyQuestions.length > 0 && !isCurrentCombinationValid();

  return (
    <div className="md:col-span-2">
      {/* <label className="block text-sm font-medium mb-1" style={{ color: colors.crimsonColor }}>
        出題情報
      </label> */}
      <div>
        {/* First row: 出題1 and 出題2 side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* First input */}
          <FormControl 
            sx={{ 
              '& .MuiOutlinedInput-root': {
                borderRadius: '6px',
              }
            }}
          >
            <InputLabel 
              id="input1-select-label"
              sx={{ 
                color: colors.crimsonColor,
                '&.Mui-focused': {
                  color: colors.crimsonColor,
                }
              }}
            >
              出題情報1
            </InputLabel>
            <Select
              labelId="input1-select-label"
              value={value.input1}
              label="出題情報1"
              onChange={(e) => handleInput1Change(e.target.value)}
              sx={{
                backgroundColor: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#D1D5DB',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#9CA3AF',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#9CA3AF',
                }
              }}
            >
              {formatOptions.map((option) => (
                <MenuItem 
                  key={option} 
                  value={option}
                  disabled={!isFormatAvailable(option)}
                  sx={{
                    color: isFormatAvailable(option) ? 'inherit' : '#999',
                    fontStyle: isFormatAvailable(option) ? 'normal' : 'italic'
                  }}
                >
                  {option}{!isFormatAvailable(option) ? ' (利用不可)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Optional second input */}
          {allowMultipleInputs && (
            <FormControl 
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  borderRadius: '6px',
                }
              }}
            >
              <InputLabel 
                id="input2-select-label"
                sx={{ 
                  color: colors.crimsonColor,
                  '&.Mui-focused': {
                    color: colors.crimsonColor,
                  }
                }}
              >
                出題情報2
              </InputLabel>
              <Select
                labelId="input2-select-label"
                value={value.input2 || 'なし'}
                label="出題情報2"
                onChange={(e) => handleInput2Change(e.target.value)}
                sx={{
                  backgroundColor: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#D1D5DB',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#9CA3AF',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#9CA3AF',
                  }
                }}
              >
                <MenuItem value="なし">なし</MenuItem>
                {formatOptions.filter(option => option !== value.input1).map((option) => (
                  <MenuItem 
                    key={option} 
                    value={option}
                    disabled={!isFormatAvailable(option)}
                    sx={{
                      color: isFormatAvailable(option) ? 'inherit' : '#999',
                      fontStyle: isFormatAvailable(option) ? 'normal' : 'italic'
                    }}
                  >
                    {option}{!isFormatAvailable(option) ? ' (利用不可)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </div>

        {/* Down arrow */}
        <div className="flex items-center justify-center">
          <span className="text-gray-400 text-xl py-1">↓</span>
        </div>

        {/* Second row: Answer output */}
        <div className="flex justify-center">
          <FormControl 
            sx={{ 
              minWidth: '50%',
              '& .MuiOutlinedInput-root': {
                borderRadius: '6px',
              }
            }}
          >
            <InputLabel 
              id="output-select-label"
              sx={{ 
                color: colors.crimsonColor,
                '&.Mui-focused': {
                  color: colors.crimsonColor,
                }
              }}
            >
              答え
            </InputLabel>
            <Select
              labelId="output-select-label"
              value={value.output}
              label="答え"
              onChange={(e) => handleOutputChange(e.target.value)}
              sx={{
                backgroundColor: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#D1D5DB',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#9CA3AF',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#9CA3AF',
                }
              }}
            >
              {formatOptions.filter(option => option !== '文脈').map((option) => (
                <MenuItem 
                  key={option} 
                  value={option}
                  disabled={!isFormatAvailable(option)}
                  sx={{
                    color: isFormatAvailable(option) ? 'inherit' : '#999',
                    fontStyle: isFormatAvailable(option) ? 'normal' : 'italic'
                  }}
                >
                  {option}{!isFormatAvailable(option) ? ' (利用不可)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
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

// Helper function to convert format to QuestionType with comprehensive combination handling
export const getQuestionTypeFromFormat = (
  input1: string,
  output: string,
  input2?: string
): QuestionType => {
  // Normalize inputs - remove duplicates and handle special cases
  const normalizeInputs = (inp1: string, inp2?: string) => {
    const inputs = [inp1];
    if (inp2 && inp2 !== 'なし' && inp2 !== inp1) {
      inputs.push(inp2);
    }
    return inputs.sort(); // Sort for consistent ordering
  };

  const inputs = normalizeInputs(input1, input2);
  const hasContext = inputs.includes('文脈');
  const hasKanji = inputs.includes('漢字');
  const hasRubi = inputs.includes('読み');
  const hasNepali = inputs.includes('ネパール語');

  // Handle compound formats (with two different inputs)
  if (inputs.length === 2) {
    // 文脈 + other field combinations
    if (hasContext && hasNepali) {
      if (output === '漢字') return QuestionType.FILL_IN_BLANK_NEPALI_TO_KANJI;
      if (output === '読み') return QuestionType.FILL_IN_BLANK_NEPALI_TO_RUBI;
    }
    if (hasContext && hasKanji) {
      if (output === 'ネパール語') return QuestionType.FILL_IN_BLANK_KANJI_TO_NEPALI;
      if (output === '読み') return QuestionType.FILL_IN_BLANK_KANJI_TO_RUBI;
    }
    if (hasContext && hasRubi) {
      if (output === 'ネパール語') return QuestionType.FILL_IN_BLANK_RUBI_TO_NEPALI;
      if (output === '漢字') return QuestionType.FILL_IN_BLANK_RUBI_TO_KANJI;
    }
    
    // Non-context combinations (新しい組み合わせ)
    if (hasKanji && hasRubi) {
      if (output === 'ネパール語') {
        // 漢字+読み → ネパール語
        return QuestionType.KANJI_RUBI_TO_NEPALI;
      }
    }
    if (hasKanji && hasNepali) {
      if (output === '読み') {
        // ネパール語+漢字 → 読み
        return QuestionType.NEPALI_KANJI_TO_RUBI;
      }
    }
    if (hasRubi && hasNepali) {
      if (output === '漢字') {
        // ネパール語+読み → 漢字
        return QuestionType.NEPALI_RUBI_TO_KANJI;
      }
    }
  }

  // Handle single input formats (unchanged)
  const singleInput = inputs[0];
  if (singleInput === 'ネパール語' && output === '漢字') return QuestionType.NEPALI_TO_KANJI;
  if (singleInput === 'ネパール語' && output === '読み') return QuestionType.NEPALI_TO_RUBI;
  if (singleInput === '漢字' && output === '読み') return QuestionType.KANJI_TO_RUBI;
  if (singleInput === '読み' && output === '漢字') return QuestionType.RUBI_TO_KANJI;
  if (singleInput === '漢字' && output === 'ネパール語') return QuestionType.KANJI_TO_NEPALI;
  if (singleInput === '読み' && output === 'ネパール語') return QuestionType.RUBI_TO_NEPALI;
  if (singleInput === '文脈' && output === '漢字') return QuestionType.FILL_IN_BLANK;
  if (singleInput === '文脈' && output === '読み') return QuestionType.FILL_IN_BLANK_TO_RUBI;
  if (singleInput === '文脈' && output === 'ネパール語') return QuestionType.FILL_IN_BLANK_TO_NEPALI;

  return QuestionType.NEPALI_TO_KANJI; // Default fallback
};