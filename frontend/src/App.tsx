import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ApplicationPage from './pages/ApplicationPage';
import RecommendPage from './pages/RecommendPage';
import PosterPage from './pages/PosterPage';
import UploadDocsPage from './pages/UploadDocsPage';
import ApplicationFormPage from './pages/ApplicationFormPage';
import ValuationPage from './pages/ValuationPage';
import AgentMonitorPage from './pages/AgentMonitorPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminCasesPage from './pages/admin/AdminCasesPage';
import AdminCaseDetailPage from './pages/admin/AdminCaseDetailPage';
import AdminRagPage from './pages/admin/AdminRagPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LIFF 客戶端頁面 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/apply" element={<ApplicationPage />} />
        <Route path="/recommend" element={<RecommendPage />} />
        <Route path="/poster" element={<PosterPage />} />
        <Route path="/upload-docs" element={<UploadDocsPage />} />
        <Route path="/application-form" element={<ApplicationFormPage />} />
        <Route path="/valuate" element={<ValuationPage />} />

        {/* 行員後台管理 */}
        <Route path="/admin/monitor" element={<AgentMonitorPage />} />
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/cases" element={<AdminCasesPage />} />
        <Route path="/admin/cases/:id" element={<AdminCaseDetailPage />} />
        <Route path="/admin/rag" element={<AdminRagPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
