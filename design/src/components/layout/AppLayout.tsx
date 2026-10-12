import { Outlet, useMatch } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import Header from './Header';
import GlobalRightPanel from './GlobalRightPanel';

export default function AppLayout() {
  const { theme } = useTheme();
  const isStockPage = useMatch('/stock/:code');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <main style={{ flex: 1, overflowY: 'auto', background: theme.bg }}>
          <Outlet />
        </main>
        {!isStockPage && <GlobalRightPanel />}
      </div>
    </div>
  );
}
