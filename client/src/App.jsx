import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register';
import AdminRegister from './pages/AdminRegister';
import AdminReset from './pages/AdminReset';
import AdminDashboard from './pages/AdminDashboard';
import Chat from './pages/Chat';
import AIChatWidget from './components/AIChatWidget';
import './styles/index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin-register" element={<AdminRegister />} />
        <Route path="/admin-reset" element={<AdminReset />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <AIChatWidget />
    </BrowserRouter>
  );
}

export default App;
