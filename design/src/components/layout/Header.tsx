import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { fetchStocks, type ApiStock } from '../../lib/api';
import { useViewport } from '../../lib/useViewport';
import NotificationBell from './NotificationBell';

export default function Header() {
  const { theme, mode, toggle } = useTheme();
  const { isMobile, isCompact } = useViewport();
  const { logout, nickname } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [stocks, setStocks] = useState<ApiStock[]>([]);
  const [stocksStatus, setStocksStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // 검색은 서버의 실제 종목 목록에서 한다. 검색창을 열 때마다 다시 받아 시세도 최신으로 보여준다
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchStocks()
      .then(data => { if (!cancelled) { setStocks(data); setStocksStatus('ready'); } })
      // 전에 받아 둔 목록이 있으면 그걸로 계속 검색한다
      .catch(() => { if (!cancelled) setStocksStatus(prev => (prev === 'ready' ? prev : 'error')); });
    return () => { cancelled = true; };
  }, [open]);

  const keyword = query.trim().toLowerCase();
  const results = stocks
    .filter(s => keyword && (s.name.toLowerCase().includes(keyword) || s.code.includes(keyword)))
    .slice(0, 6);

  return (
    // 휴대폰에서는 메뉴를 둘째 줄로 내려 가로 스크롤로 보여준다
    <div style={{
      minHeight: 64, flexShrink: 0,
      display: 'flex', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap',
      gap: isMobile ? 10 : isCompact ? 12 : 20,
      padding: isMobile ? '10px 16px 0' : '0 24px',
      borderBottom: `1px solid ${theme.border}`,
      background: theme.panel,
    }}>
      <div
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', cursor: 'pointer',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg, #4F6EF7, #7B5EA7)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
            <polyline points="8,48 22,36 32,41 44,22" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="44" cy="22" r="6" fill="white" opacity="0.3"/>
            <circle cx="44" cy="22" r="4" fill="white"/>
            <line x1="44" y1="12" x2="44" y2="16" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.8"/>
            <line x1="54" y1="22" x2="50" y2="22" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.8"/>
            <line x1="51" y1="15" x2="48" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.8"/>
          </svg>
        </div>
        {!isMobile && <span>모이고</span>}
      </div>

      {/* 네비게이션 */}
      <nav className="hide-scrollbar" style={{
        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        ...(isMobile ? { order: 10, width: '100%', overflowX: 'auto', padding: '2px 0 8px' } : {}),
      }}>
        {[
          { label: '홈', path: '/dashboard' },
          { label: 'AI 분석', path: '/ai-analysis' },
          { label: '랭킹', path: '/ranking' },
          { label: '피드', path: '/feed' },
          { label: '내 계좌', path: '/portfolio' },
        ].map(({ label, path }) => {
          const active = location.pathname === path;
          return (
            <div
              key={label}
              onClick={() => navigate(path)}
              style={{
                padding: isCompact ? '6px 10px' : '6px 14px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? theme.ai : theme.textMuted,
                background: active ? theme.aiSoft : 'transparent',
              }}
            >
              {label}
            </div>
          );
        })}
      </nav>

      <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? 'none' : 420, position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.panel2, border: `1px solid ${theme.border}`,
          borderRadius: 9, padding: '9px 14px', color: theme.textMuted, fontSize: 13,
        }}>
          <span>🔍</span>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={isMobile ? '종목 검색' : '종목명 또는 코드 검색'}
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: theme.text, fontFamily: 'inherit',
            }}
          />
          {open && (
            <span
              onClick={() => { setOpen(false); setQuery(''); }}
              style={{ cursor: 'pointer' }}
            >✕</span>
          )}
        </div>

        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 15 }}
          />
        )}

        {open && keyword && results.length === 0 && stocksStatus !== 'loading' && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            padding: '14px', fontSize: 13, color: theme.textMuted, zIndex: 20,
          }}>
            {stocksStatus === 'error' ? '종목 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' : '검색 결과가 없습니다'}
          </div>
        )}

        {open && results.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            overflow: 'hidden', zIndex: 20,
          }}>
            {results.map(s => (
              <div
                key={s.code}
                onClick={() => { navigate(`/stock/${s.code}`); setOpen(false); setQuery(''); }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: `1px solid ${theme.border}`,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: theme.textMuted }}>{s.code}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {s.current_price != null ? `${s.current_price.toLocaleString()}원` : '-'}
                  </div>
                  {s.change_rate != null && (
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: s.change_rate >= 0 ? theme.up : theme.down,
                    }}>
                      {s.change_rate >= 0 ? '▲' : '▼'}{Math.abs(s.change_rate * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, flexShrink: 0 }}>
        <div
          onClick={toggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 20, border: `1px solid ${theme.border}`,
            cursor: 'pointer', fontSize: 13, fontWeight: 600, color: theme.textMuted,
          }}
        >
          <span>{mode === 'dark' ? '🌙' : '☀️'}</span>
          {!isCompact && <span>{mode === 'dark' ? '다크' : '라이트'}</span>}
        </div>
        <NotificationBell />
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setProfileOpen(prev => !prev)}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: theme.ai, border: `2px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: theme.aiText, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {nickname ? nickname[0].toUpperCase() : '👤'}
          </div>

          {profileOpen && (
            <>
              <div
                onClick={() => setProfileOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 15 }}
              />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: theme.panel, border: `1px solid ${theme.border}`,
                borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.25)',
                overflow: 'hidden', zIndex: 20, minWidth: 200,
              }}>
                {/* 사용자 정보 */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px', borderBottom: `1px solid ${theme.border}`,
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: theme.ai, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: theme.aiText, fontWeight: 700,
                  }}>
                    {nickname ? nickname[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {nickname || '사용자'}님
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                      어서오세요!
                    </div>
                  </div>
                </div>

                {/* 메뉴 항목 */}
                <div
                  onClick={() => { navigate('/portfolio'); setProfileOpen(false); }}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', fontSize: 13,
                    borderBottom: `1px solid ${theme.border}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span>📊</span> 내 포트폴리오 보기
                </div>
                <div
                  onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', fontSize: 13,
                    borderBottom: `1px solid ${theme.border}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span>⚙️</span> 회원 설정
                </div>
                <div
                  onClick={async () => { await logout(); setProfileOpen(false); }}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', fontSize: 13,
                    color: '#ef4444',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span>🚪</span> 로그아웃
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
