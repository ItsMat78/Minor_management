import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GroupFormation from './pages/GroupFormation';
import ProjectProposal from './pages/ProjectProposal';
import MenteeGroupPage from './pages/MenteeGroupPage';

import AdminDashboard from './pages/AdminDashboard';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/group/create" element={<ProtectedRoute><GroupFormation /></ProtectedRoute>} />
          <Route path="/project/propose" element={<ProtectedRoute><ProjectProposal /></ProtectedRoute>} />
          <Route path="/faculty/group/:groupId" element={<ProtectedRoute><MenteeGroupPage /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode, adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'Admin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-neutral-50 m-0 p-0">
      <div className="flex-1 overflow-hidden w-full relative">
        {children}
      </div>
    </div>
  );
};

export default App;
