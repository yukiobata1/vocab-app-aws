import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home'
// import Teacher from './pages/Teacher'

import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
