import { vocabApi, type BooksResponse, type QuestionsResponse } from '../config/api';

// Generic API call function
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  // Only add Content-Type header for requests with a body (POST, PUT, etc.)
  const headers: Record<string, string> = {};
  
  // Copy existing headers if they exist
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }
  
  // Add Content-Type only if there's a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Handle AWS Lambda response format where actual data is in body property as JSON string
  if (data.body && typeof data.body === 'string') {
    return JSON.parse(data.body);
  }
  
  return data;
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

