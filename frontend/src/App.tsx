import { useState } from 'react';
import { TeacherDashboard } from './components/Quiz/TeacherDashboard';
import { StudentContainer } from './components/Quiz/StudentContainer';
import { colors } from './config/colors';
import './App.css';

type AppMode = 'teacher' | 'student';

function App() {
  const [mode, setMode] = useState<AppMode>('teacher');
  const { crimsonColor } = colors;
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 発展したヘッダー */}
      <header className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto">
          {/* メインヘッダー */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-3">
              <img 
                src="/logo.gif" 
                alt="早稲田言語学院ロゴ" 
                className="h-10 w-auto"
              />
              <div className="text-2xl font-bold" style={{ color: crimsonColor }}>
                早稲田言語学院単語アプリ
              </div>
            </div>
            
            {/* 将来のログイン機能エリア */}
            <div className="flex items-center space-x-4">
              <button 
                className="text-sm hidden md:block hover:opacity-80 transition-opacity"
                style={{ color: crimsonColor }}
              >
                設定
              </button>
            </div>
          </div>
          
          {/* ユーザータイプ選択バー */}
          <div className="border-t border-gray-200">
            <nav className="px-6">
              <div className="flex space-x-8">
                <button
                  onClick={() => setMode('teacher')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-all ${
                    mode === 'teacher'
                      ? ''
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  style={mode === 'teacher' ? {
                    borderColor: crimsonColor,
                    color: crimsonColor
                  } : {}}
                >
                  <span className="flex items-center space-x-2">
                    <span>👨‍🏫</span>
                    <span>教師用</span>
                  </span>
                </button>
                <button
                  onClick={() => setMode('student')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-all ${
                    mode === 'student'
                      ? ''
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  style={mode === 'student' ? {
                    borderColor: crimsonColor,
                    color: crimsonColor
                  } : {}}
                >
                  <span className="flex items-center space-x-2">
                    <span>👨‍🎓</span>
                    <span>生徒用</span>
                  </span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {mode === 'teacher' ? <TeacherDashboard /> : <StudentContainer />}
      </main>
    </div>
  );
}

export default App;