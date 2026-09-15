import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StockDetailPage from './pages/StockDetailPage';
import PortfolioPage from './pages/PortfolioPage';
import AppLayout from './components/layout/AppLayout';

export default function App() {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/stock/:code" element={<StockDetailPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
