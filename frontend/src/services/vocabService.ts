import { vocabApi, BooksResponse, QuestionsResponse, VocabQuestion } from '../config/api';

// Generic API call function
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Vocabulary API service
export const vocabService = {
  // Get all vocabulary books
  async getBooks(limit: number = 50, offset: number = 0): Promise<BooksResponse> {
    const url = vocabApi.getBooks(limit, offset);
    return apiCall<BooksResponse>(url);
  },

  // Get questions from a specific book
  async getQuestions(bookId: number, limit: number = 50, offset: number = 0): Promise<QuestionsResponse> {
    const url = vocabApi.getQuestions(bookId, limit, offset);
    return apiCall<QuestionsResponse>(url);
  },

  // Create a new vocabulary book
  async createBook(bookData: {
    name: string;
    description?: string;
    level?: string;
    language_pair?: string;
  }) {
    return apiCall(vocabApi.vocab(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_book',
        data: bookData,
      }),
    });
  },

  // Create a new vocabulary question
  async createQuestion(questionData: {
    book_id: number;
    ka: number;
    np1: string;
    jp_kanji: string;
    jp_rubi: string;
    nepali_sentence?: string;
    japanese_question?: string;
    japanese_example?: string;
  }) {
    return apiCall(vocabApi.vocab(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_question',
        data: questionData,
      }),
    });
  },

  // Update a vocabulary book
  async updateBook(bookId: number, updateData: {
    name?: string;
    description?: string;
    level?: string;
    language_pair?: string;
  }) {
    return apiCall(vocabApi.vocab(), {
      method: 'PUT',
      body: JSON.stringify({
        action: 'update_book',
        data: { id: bookId, ...updateData },
      }),
    });
  },

  // Update a vocabulary question
  async updateQuestion(questionId: number, updateData: {
    ka?: number;
    np1?: string;
    jp_kanji?: string;
    jp_rubi?: string;
    nepali_sentence?: string;
    japanese_question?: string;
    japanese_example?: string;
  }) {
    return apiCall(vocabApi.vocab(), {
      method: 'PUT',
      body: JSON.stringify({
        action: 'update_question',
        data: { id: questionId, ...updateData },
      }),
    });
  },

  // Run database migrations
  async runMigration(action: 'create_tables' | 'check_tables' = 'create_tables') {
    return apiCall(vocabApi.migrate(), {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },
};

// Custom hooks for React components
export const useVocabApi = () => {
  return {
    getBooks: vocabService.getBooks,
    getQuestions: vocabService.getQuestions,
    createBook: vocabService.createBook,
    createQuestion: vocabService.createQuestion,
    updateBook: vocabService.updateBook,
    updateQuestion: vocabService.updateQuestion,
    runMigration: vocabService.runMigration,
  };
};