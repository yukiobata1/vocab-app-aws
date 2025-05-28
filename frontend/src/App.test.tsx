import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders loading state initially', () => {
    render(<App />);
    expect(screen.getByText(/読み込み中.../i)).toBeInTheDocument();
  });

  // ここにさらにテストケースを追加していきます
  // 例: データロード後の表示確認、ボタンクリック時の動作確認など
}); 