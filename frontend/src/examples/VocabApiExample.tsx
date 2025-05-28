import React, { useState, useEffect } from 'react';
import { vocabService } from '../services/vocabService';
import type { VocabBook, VocabQuestion } from '../config/api';

// Example component showing how to use the vocab API
const VocabApiExample: React.FC = () => {
  const [books, setBooks] = useState<VocabBook[]>([]);
  const [questions, setQuestions] = useState<VocabQuestion[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load books on component mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await vocabService.getBooks(20, 0);
      setBooks(response.books);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (bookId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await vocabService.getQuestions(bookId, 50, 0);
      setQuestions(response.questions);
      setSelectedBookId(bookId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const createNewBook = async () => {
    try {
      setLoading(true);
      setError(null);
      await vocabService.createBook({
        name: 'New Test Book',
        description: 'Created from React app',
        level: 'N5',
        language_pair: 'JP-NP'
      });
      // Reload books to show the new one
      await loadBooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create book');
    } finally {
      setLoading(false);
    }
  };

  const createNewQuestion = async () => {
    if (!selectedBookId) {
      setError('Please select a book first');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await vocabService.createQuestion({
        book_id: selectedBookId,
        ka: questions.length + 1,
        np1: 'नयाँ',
        jp_kanji: '新しい',
        jp_rubi: 'あたらしい',
        japanese_question: '（　　）車を買いました。',
        japanese_example: '新しい車を買いました。'
      });
      // Reload questions to show the new one
      await loadQuestions(selectedBookId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Vocabulary API Example</h1>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '20px', padding: '10px', backgroundColor: '#ffe6e6' }}>
          Error: {error}
        </div>
      )}

      {loading && <div>Loading...</div>}

      <section style={{ marginBottom: '30px' }}>
        <h2>Vocabulary Books</h2>
        <button onClick={createNewBook} disabled={loading}>
          Create New Book
        </button>
        <div style={{ marginTop: '10px' }}>
          {books.map((book) => (
            <div
              key={book.id}
              style={{
                border: '1px solid #ccc',
                padding: '10px',
                margin: '5px 0',
                cursor: 'pointer',
                backgroundColor: selectedBookId === book.id ? '#e6f3ff' : 'white'
              }}
              onClick={() => loadQuestions(book.id)}
            >
              <h3>{book.name}</h3>
              <p>{book.description}</p>
              <small>Level: {book.level} | Questions: {book.question_count}</small>
            </div>
          ))}
        </div>
      </section>

      {selectedBookId && (
        <section>
          <h2>Questions (Book ID: {selectedBookId})</h2>
          <button onClick={createNewQuestion} disabled={loading}>
            Create New Question
          </button>
          <div style={{ marginTop: '10px' }}>
            {questions.map((question) => (
              <div
                key={question.id}
                style={{
                  border: '1px solid #ddd',
                  padding: '10px',
                  margin: '5px 0',
                  backgroundColor: '#f9f9f9'
                }}
              >
                <div><strong>Ka:</strong> {question.ka}</div>
                <div><strong>Nepali:</strong> {question.np1}</div>
                <div><strong>Kanji:</strong> {question.jp_kanji}</div>
                <div><strong>Rubi:</strong> {question.jp_rubi}</div>
                {question.japanese_question && (
                  <div><strong>Question:</strong> {question.japanese_question}</div>
                )}
                {question.japanese_example && (
                  <div><strong>Example:</strong> {question.japanese_example}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default VocabApiExample;