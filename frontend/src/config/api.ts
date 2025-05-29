// API Configuration
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://3typ7gyorh.execute-api.ap-northeast-1.amazonaws.com/dev',
  endpoints: {
    vocab: import.meta.env.VITE_API_VOCAB_ENDPOINT || '/vocab',
    migrate: import.meta.env.VITE_API_MIGRATE_ENDPOINT || '/migrate',
    room: import.meta.env.VITE_API_ROOM_ENDPOINT || '/room',
  },
  environment: import.meta.env.VITE_APP_ENV || 'development',
} as const;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: keyof typeof API_CONFIG.endpoints, params?: Record<string, string>) => {
  const baseUrl = API_CONFIG.baseUrl;
  const endpointPath = API_CONFIG.endpoints[endpoint];
  // baseUrlが既に/devを含んでいるので、単純に結合する
  const fullUrl = `${baseUrl}${endpointPath}`;
  const url = new URL(fullUrl);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  return url.toString();
};

// API client functions
export const vocabApi = {
  // Get all books
  getBooks: (limit: number = 50, offset: number = 0) =>
    buildApiUrl('vocab', { limit: limit.toString(), offset: offset.toString() }),
  
  // Get questions from a book
  getQuestions: (bookId: number, limit: number = 50, offset: number = 0) =>
    buildApiUrl('vocab', { 
      book_id: bookId.toString(), 
      limit: limit.toString(), 
      offset: offset.toString() 
    }),
  
  // Create/Update endpoints (for POST/PUT requests)
  vocab: () => `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.vocab}`,
  migrate: () => `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.migrate}`,
};

// Types for API responses
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
  book_id: number;
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

export interface BooksResponse {
  books: VocabBook[];
  total: number;
  offset: number;
  limit: number;
}

export interface QuestionsResponse {
  book: VocabBook;
  questions: VocabQuestion[];
  total: number;
  offset: number;
  limit: number;
}