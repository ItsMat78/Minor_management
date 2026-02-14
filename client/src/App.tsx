import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GroupFormation from './pages/GroupFormation';
import ProjectProposal from './pages/ProjectProposal';

import AdminDashboard from './pages/AdminDashboard'; // Import added

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

  return <>{children}</>;
};

export default App;
