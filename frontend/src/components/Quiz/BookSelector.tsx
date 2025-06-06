import React from 'react';
import { colors } from '../../config/colors';
import type { VocabBook } from '../../types/quiz';

interface BookSelectorProps {
  books: VocabBook[];
  selectedBookId: number | null;
  onBookChange: (bookId: number) => void;
  disabled?: boolean;
  loading?: boolean;
}

export const BookSelector: React.FC<BookSelectorProps> = ({
  books,
  selectedBookId,
  onBookChange,
  disabled = false,
  loading = false
}) => {
  const { crimsonColor } = colors;

  return (
    <div className="md:col-span-2">
      <label htmlFor="bookSelect" className="block text-sm font-medium mb-1" style={{ color: crimsonColor }}>
        教材選択
      </label>
      <select
        id="bookSelect"
        value={selectedBookId || ''}
        onChange={(e) => {
          const value = e.target.value;
          if (value) {
            onBookChange(Number(value));
          }
        }}
        className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:border-gray-500"
        disabled={disabled || loading}
        required
      >
        {!selectedBookId && <option value="">教材を選択してください</option>}
        {books.map(book => (
          <option key={book.id} value={book.id}>
            {book.name} - {book.level} ({book.question_count}問)
          </option>
        ))}
      </select>
    </div>
  );
};