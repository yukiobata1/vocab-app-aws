import type { VocabQuestion, QuestionTypeConfig, QuestionType } from '../types/quiz';
import { QUESTION_TYPE_CONFIGS } from '../types/quiz';

/**
 * Detects which fields are available in a set of vocabulary questions
 * A field is considered available if it exists and is not empty in at least one question
 */
export const detectAvailableFields = (questions: VocabQuestion[]): Set<keyof VocabQuestion> => {
  const availableFields = new Set<keyof VocabQuestion>();
  
  questions.forEach(question => {
    // Check each field that might be used in quiz generation
    const fieldsToCheck: (keyof VocabQuestion)[] = [
      'np1', 'jp_kanji', 'jp_rubi', 'japanese_question', 'nepali_sentence', 'japanese_example'
    ];
    
    fieldsToCheck.forEach(field => {
      const value = question[field];
      // Consider field available if it has a non-empty string value
      if (typeof value === 'string' && value.trim() !== '') {
        availableFields.add(field);
      }
    });
  });
  
  return availableFields;
};

/**
 * Filters question types to only include those compatible with available fields
 * A question type is compatible if all required fields are available
 */
export const getCompatibleQuestionTypes = (availableFields: Set<keyof VocabQuestion>): QuestionType[] => {
  const compatibleTypes: QuestionType[] = [];
  
  Object.values(QUESTION_TYPE_CONFIGS).forEach(config => {
    // Check if all required fields are available
    const requiredFields = [...config.questionFields, config.answerField, config.optionsField];
    const isCompatible = requiredFields.every(field => availableFields.has(field));
    
    if (isCompatible && config.enabled) {
      compatibleTypes.push(config.id);
    }
  });
  
  return compatibleTypes;
};

/**
 * Gets the configurations for compatible question types
 */
export const getCompatibleQuestionTypeConfigs = (availableFields: Set<keyof VocabQuestion>): QuestionTypeConfig[] => {
  const compatibleTypes = getCompatibleQuestionTypes(availableFields);
  return compatibleTypes.map(type => QUESTION_TYPE_CONFIGS[type]);
};

/**
 * Checks if a specific question type is compatible with available fields
 */
export const isQuestionTypeCompatible = (
  questionType: QuestionType, 
  availableFields: Set<keyof VocabQuestion>
): boolean => {
  const config = QUESTION_TYPE_CONFIGS[questionType];
  const requiredFields = [...config.questionFields, config.answerField, config.optionsField];
  return requiredFields.every(field => availableFields.has(field));
};

/**
 * Analyzes a vocabulary book's questions and returns field availability summary
 */
export interface FieldAvailabilityAnalysis {
  availableFields: Set<keyof VocabQuestion>;
  compatibleQuestionTypes: QuestionType[];
  fieldCounts: Record<string, number>;
  totalQuestions: number;
  incompatibleQuestionTypes: {
    type: QuestionType;
    missingFields: string[];
    config: QuestionTypeConfig;
  }[];
}

export const analyzeFieldAvailability = (questions: VocabQuestion[]): FieldAvailabilityAnalysis => {
  const availableFields = detectAvailableFields(questions);
  const compatibleTypes = getCompatibleQuestionTypes(availableFields);
  
  // Count how many questions have each field populated
  const fieldCounts: Record<string, number> = {};
  const fieldsToCheck: (keyof VocabQuestion)[] = [
    'np1', 'jp_kanji', 'jp_rubi', 'japanese_question', 'nepali_sentence', 'japanese_example'
  ];
  
  fieldsToCheck.forEach(field => {
    fieldCounts[field] = questions.filter(q => {
      const value = q[field];
      return typeof value === 'string' && value.trim() !== '';
    }).length;
  });
  
  // Find incompatible question types and their missing fields
  const incompatibleQuestionTypes = Object.values(QUESTION_TYPE_CONFIGS)
    .filter(config => !compatibleTypes.includes(config.id))
    .map(config => {
      const requiredFields = [...config.questionFields, config.answerField, config.optionsField];
      const missingFields = requiredFields.filter(field => !availableFields.has(field));
      return {
        type: config.id,
        missingFields,
        config
      };
    });
  
  return {
    availableFields,
    compatibleQuestionTypes: compatibleTypes,
    fieldCounts,
    totalQuestions: questions.length,
    incompatibleQuestionTypes
  };
};

/**
 * Generates fallback question text for missing japanese_question fields
 */
export const generateFallbackQuestionText = (question: VocabQuestion, questionType: QuestionType): string => {
  const config = QUESTION_TYPE_CONFIGS[questionType];
  
  // If japanese_question is required but missing, generate a fallback
  if (config.questionFields.includes('japanese_question') && !question.japanese_question?.trim()) {
    if (questionType.includes('FILL_IN_BLANK')) {
      // For fill-in-blank questions, create a generic context
      if (question.jp_kanji) {
        return `この語彙「${question.jp_kanji}」の（　）を選んでください。`;
      } else if (question.jp_rubi) {
        return `この語彙「${question.jp_rubi}」の（　）を選んでください。`;
      }
      return 'この語彙の（　）を選んでください。';
    }
  }
  
  return question.japanese_question || '';
};