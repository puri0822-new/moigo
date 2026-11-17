import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import AppLayout from './components/layout/AppLayout';

// 페이지마다 따로 받는다. 첫 화면(랜딩)은 바로 그리고, 차트 라이브러리처럼 큰 코드는 그 페이지에 들어갈 때만 받는다
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StockDetailPage = lazy(() => import('./pages/StockDetailPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const RankingPage = lazy(() => import('./pages/RankingPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const AiAnalysisPage = lazy(() => import('./pages/AiAnalysisPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));

function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.bg, color: theme.text, minHeight: '100vh' }}>
      {/* 로그인 뒤 페이지는 AppLayout 안의 Suspense가 받으므로, 여기서는 로그인·회원가입 화면만 기다린다 */}
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ai-analysis" element={<AiAnalysisPage />} />
          <Route path="/stock/:code" element={<StockDetailPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </div>
  );
}
