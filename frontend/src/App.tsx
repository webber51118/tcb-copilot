import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ApplicationPage from './pages/ApplicationPage';
import RecommendPage from './pages/RecommendPage';
import PosterPage from './pages/PosterPage';
import UploadDocsPage from './pages/UploadDocsPage';
import ApplicationFormPage from './pages/ApplicationFormPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/apply" element={<ApplicationPage />} />
        <Route path="/recommend" element={<RecommendPage />} />
        <Route path="/poster" element={<PosterPage />} />
        <Route path="/upload-docs" element={<UploadDocsPage />} />
        <Route path="/application-form" element={<ApplicationFormPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
