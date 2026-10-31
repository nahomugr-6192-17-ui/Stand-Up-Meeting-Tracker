import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import TeamDashboardPage from './pages/TeamDashboardPage';
import TeamMeetingDetailsPage from './pages/TeamMeetingDetailsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminMeetingEditorPage from './pages/AdminMeetingEditorPage';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#668284',
        fontFamily: "'Ubuntu', sans-serif"
      }}>
        LOADING...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/team" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public / Auth */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Team Protected Routes */}
          <Route
            path="/team"
            element={
              <ProtectedRoute requiredRole="TEAM">
                <TeamDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team/meetings/:meetingId"
            element={
              <ProtectedRoute requiredRole="TEAM">
                <TeamMeetingDetailsPage />
              </ProtectedRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/meetings/:meetingId"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminMeetingEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

