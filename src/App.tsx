import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { TeacherPanel } from './components/TeacherPanel';
import { StudentDashboard } from './pages/StudentDashboard';
import { ExamPage } from './pages/ExamPage';
import { ResultsPage } from './pages/ResultsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute requiredRole="teacher">
                <TeacherPanel />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/student-dashboard"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/exam/:examId"
            element={
              <ProtectedRoute requiredRole="student">
                <ExamPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/results/:resultId"
            element={
              <ProtectedRoute requiredRole="student">
                <ResultsPage />
              </ProtectedRoute>
            }
          />
          
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
