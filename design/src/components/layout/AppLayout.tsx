import { Suspense } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import Header from './Header';
import GlobalRightPanel from './GlobalRightPanel';
import { useViewport } from '../../lib/useViewport';

export default function AppLayout() {
  const { theme } = useTheme();
  const isStockPage = useMatch('/stock/:code');
  // 좁은 화면에서는 본문 폭을 우선하고 우측 패널을 숨긴다 (같은 정보는 내 계좌·AI 분석 화면에 있다)
  const { isCompact } = useViewport();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <main style={{ flex: 1, overflowY: 'auto', background: theme.bg }}>
          {/* 페이지 코드를 받는 동안 헤더와 우측 패널은 그대로 두고 본문만 비워 둔다 */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
        {!isStockPage && !isCompact && <GlobalRightPanel />}
      </div>
    </div>
  );
}
