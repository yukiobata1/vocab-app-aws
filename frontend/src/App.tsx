import React, { useState } from 'react';
import { TeacherDashboard } from './components/Quiz/TeacherDashboard';
import { StudentContainer } from './components/Quiz/StudentContainer';
import './App.css';

type AppMode = 'teacher' | 'student';

function App() {
  const [mode, setMode] = useState<AppMode>('teacher');

  const renderModeSelector = () => (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => setMode('teacher')}
          className={`px-6 py-3 font-medium transition-all duration-200 ${
            mode === 'teacher'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          👨‍🏫 教師用
        </button>
        <button
          onClick={() => setMode('student')}
          className={`px-6 py-3 font-medium transition-all duration-200 ${
            mode === 'student'
              ? 'bg-green-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          👨‍🎓 生徒用
        </button>
      </div>
    </div>
  );

  return (
    <div className="App">
      {renderModeSelector()}
      {mode === 'teacher' ? <TeacherDashboard /> : <StudentContainer />}
    </div>
  );
}

export default App;
