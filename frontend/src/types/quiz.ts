// Quiz configuration and question types

export interface VocabBook {
  id: number;
  name: string;
  description: string;
  level: string;
  language_pair: string;
  created_at: string;
  updated_at: string;
  question_count: number;
}

export interface VocabQuestion {
  id: number;
  ka: number;
  np1: string;
  jp_kanji: string;
  jp_rubi: string;
  nepali_sentence: string;
  japanese_question: string;
  japanese_example: string;
  extra_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Quiz question types
export const QuestionType = {
  NEPALI_TO_KANJI: 'nepali_to_kanji',           // ネパール語 → 漢字
  NEPALI_TO_RUBI: 'nepali_to_rubi',             // ネパール語 → 読み
  KANJI_TO_RUBI: 'kanji_to_rubi',               // 漢字 → 読み
  RUBI_TO_KANJI: 'rubi_to_kanji',               // 読み → 漢字
  FILL_IN_BLANK: 'fill_in_blank',               // 文脈問題（空欄埋め）
  KANJI_TO_NEPALI: 'kanji_to_nepali',           // 漢字 → ネパール語
  RUBI_TO_NEPALI: 'rubi_to_nepali',             // 読み → ネパール語
  FILL_IN_BLANK_NEPALI_TO_KANJI: 'fill_in_blank_nepali_to_kanji', // 文脈+ネパール語 → 漢字
  FILL_IN_BLANK_NEPALI_TO_RUBI: 'fill_in_blank_nepali_to_rubi'   // 文脈+ネパール語 → 読み
} as const;

export type QuestionType = typeof QuestionType[keyof typeof QuestionType];

export interface QuestionTypeConfig {
  id: QuestionType;
  name: string;
  description: string;
  questionFields: (keyof VocabQuestion)[];  // 問題文として使うフィールド（複数可）
  answerField: keyof VocabQuestion;         // 正解として使うフィールド
  optionsField: keyof VocabQuestion;        // 選択肢生成に使うフィールド
  enabled: boolean;
}

// Available question types configuration
export const QUESTION_TYPE_CONFIGS: Record<QuestionType, QuestionTypeConfig> = {
  [QuestionType.NEPALI_TO_KANJI]: {
    id: QuestionType.NEPALI_TO_KANJI,
    name: 'ネパール語 → 漢字',
    description: 'ネパール語を見て漢字を選ぶ',
    questionFields: ['np1'],
    answerField: 'jp_kanji',
    optionsField: 'jp_kanji',
    enabled: true
  },
  [QuestionType.NEPALI_TO_RUBI]: {
    id: QuestionType.NEPALI_TO_RUBI,
    name: 'ネパール語 → 読み',
    description: 'ネパール語を見て読みを選ぶ',
    questionFields: ['np1'],
    answerField: 'jp_rubi',
    optionsField: 'jp_rubi',
    enabled: true
  },
  [QuestionType.KANJI_TO_RUBI]: {
    id: QuestionType.KANJI_TO_RUBI,
    name: '漢字 → 読み',
    description: '漢字を見て読みを選ぶ',
    questionFields: ['jp_kanji'],
    answerField: 'jp_rubi',
    optionsField: 'jp_rubi',
    enabled: true
  },
  [QuestionType.RUBI_TO_KANJI]: {
    id: QuestionType.RUBI_TO_KANJI,
    name: '読み → 漢字',
    description: '読みを見て漢字を選ぶ',
    questionFields: ['jp_rubi'],
    answerField: 'jp_kanji',
    optionsField: 'jp_kanji',
    enabled: true
  },
  [QuestionType.FILL_IN_BLANK]: {
    id: QuestionType.FILL_IN_BLANK,
    name: '文脈問題',
    description: '文脈から適切な語彙を選ぶ',
    questionFields: ['japanese_question'],
    answerField: 'jp_kanji',
    optionsField: 'jp_kanji',
    enabled: true
  },
  [QuestionType.KANJI_TO_NEPALI]: {
    id: QuestionType.KANJI_TO_NEPALI,
    name: '漢字 → ネパール語',
    description: '漢字を見てネパール語を選ぶ',
    questionFields: ['jp_kanji'],
    answerField: 'np1',
    optionsField: 'np1',
    enabled: true
  },
  [QuestionType.RUBI_TO_NEPALI]: {
    id: QuestionType.RUBI_TO_NEPALI,
    name: '読み → ネパール語',
    description: '読みを見てネパール語を選ぶ',
    questionFields: ['jp_rubi'],
    answerField: 'np1',
    optionsField: 'np1',
    enabled: true
  },
  [QuestionType.FILL_IN_BLANK_NEPALI_TO_KANJI]: {
    id: QuestionType.FILL_IN_BLANK_NEPALI_TO_KANJI,
    name: '文脈+ネパール語 → 漢字',
    description: '文脈とネパール語を見て漢字を選ぶ',
    questionFields: ['japanese_question', 'np1'],
    answerField: 'jp_kanji',
    optionsField: 'jp_kanji',
    enabled: true
  },
  [QuestionType.FILL_IN_BLANK_NEPALI_TO_RUBI]: {
    id: QuestionType.FILL_IN_BLANK_NEPALI_TO_RUBI,
    name: '文脈+ネパール語 → 読み',
    description: '文脈とネパール語を見て読みを選ぶ',
    questionFields: ['japanese_question', 'np1'],
    answerField: 'jp_rubi',
    optionsField: 'jp_rubi',
    enabled: true
  }
};

// Quiz configuration
export interface QuizConfig {
  bookId: number;
  bookTitle?: string;
  questionCount: number;           // 出題数 (5, 10, 15, 20, etc.)
  lessonRange: {                  // 課の範囲
    start: number;
    end: number;
  };
  enabledQuestionTypes: QuestionType[];  // 有効な出題形式
  difficulty?: string;
}

// Generated quiz question for display
export interface GeneratedQuizQuestion {
  id: string;
  type: QuestionType;
  question: string;              // 問題文
  correctAnswer: string;         // 正解
  options: string[];            // 選択肢（正解を含む4択）
  sourceQuestion: VocabQuestion; // 元の語彙データ
}

// Quiz question for display (simplified interface)
export interface QuizQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  correctAnswer: string;
  options: string[];
}

// Quiz interface (used by components)
export interface Quiz {
  id: string;
  config: QuizConfig;
  questions: QuizQuestion[];
  createdAt: string;
}

// Quiz session state
export interface QuizSession {
  config: QuizConfig;
  questions: GeneratedQuizQuestion[];
  currentQuestionIndex: number;
  answers: (string | null)[];
  startTime: Date;
  endTime?: Date;
  score?: number;
}

// Quiz template (fixed questions, variable options)
export interface QuizTemplate {
  id: string;
  name: string;
  config: QuizConfig;
  templateQuestions: QuizTemplateQuestion[];
  createdAt: string;
  createdBy: string;
}

export interface QuizTemplateQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  correctAnswer: string;
  sourceVocabId: number;
  allPossibleOptions: string[]; // All available wrong answers
}

// Individual quiz instance from template
export interface QuizInstance {
  templateId: string;
  studentId: string;
  questions: QuizQuestion[];
  generatedAt: string;
}

// Room code based quiz room
export interface QuizRoom {
  roomCode: string;
  config: QuizConfig;
  questions: QuizQuestion[];
  createdAt: string;
  expiresAt: string;
  createdBy: string; // "guest" for non-authenticated users
  studentsJoined: string[];
}

// Room code API responses
export interface CreateRoomResponse {
  roomCode: string;
  expiresAt: string;
}

export interface GetRoomResponse {
  room: QuizRoom;
}

// Student modes
export type StudentMode = 'study' | 'classroom';

// User context for guest/authenticated users
export interface UserContext {
  isAuthenticated: boolean;
  userId?: string;
  name?: string;
  isGuest: boolean;
}