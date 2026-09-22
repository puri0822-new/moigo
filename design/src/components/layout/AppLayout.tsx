import { Outlet } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'auto', background: theme.bg }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
