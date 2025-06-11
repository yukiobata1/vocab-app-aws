import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
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
      <FormControl 
        fullWidth 
        disabled={disabled || loading}
        sx={{ 
          '& .MuiOutlinedInput-root': {
            borderRadius: '6px',
          }
        }}
      >
        <InputLabel 
          id="bookSelect-label"
          sx={{ 
            color: crimsonColor,
            '&.Mui-focused': {
              color: crimsonColor,
            }
          }}
        >
          教材選択
        </InputLabel>
        <Select
          labelId="bookSelect-label"
          id="bookSelect"
          value={selectedBookId || ''}
          label="教材選択"
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              onBookChange(Number(value));
            }
          }}
          sx={{
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
          {!selectedBookId && (
            <MenuItem value="">
              <em>教材を選択してください</em>
            </MenuItem>
          )}
          {books.map(book => (
            <MenuItem key={book.id} value={book.id}>
              {book.name} - {book.level} ({book.question_count}問)
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};