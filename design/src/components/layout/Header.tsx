import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { stocks } from '../../data/mockData';

export default function Header() {
  const { theme, mode, toggle } = useTheme();
  const { logout, nickname } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const results = stocks
    .filter(s => query && (s.name.includes(query) || s.code.includes(query)))
    .slice(0, 6);

  return (
    <div style={{
      height: 64, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 20, padding: '0 24px',
      borderBottom: `1px solid ${theme.border}`,
      background: theme.panel,
    }}>
      <div
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', cursor: 'pointer',
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 7, background: theme.ai,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: theme.bg,
        }}>AI</div>
        <span>모의투자</span>
      </div>

      <div style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
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
            placeholder="종목명 또는 코드 검색"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
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
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{s.price}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: s.changePct >= 0 ? theme.up : theme.down,
                  }}>
                    {s.changePct >= 0 ? '▲' : '▼'}{Math.abs(s.changePct).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          onClick={toggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 20, border: `1px solid ${theme.border}`,
            cursor: 'pointer', fontSize: 13, fontWeight: 600, color: theme.textMuted,
          }}
        >
          <span>{mode === 'dark' ? '🌙' : '☀️'}</span>
          <span>{mode === 'dark' ? '다크' : '라이트'}</span>
        </div>
        <div style={{ fontSize: 19, cursor: 'pointer' }}>🔔</div>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setProfileOpen(prev => !prev)}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: theme.ai, border: `2px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: theme.bg, fontWeight: 700, cursor: 'pointer',
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
                    fontSize: 18, color: theme.bg, fontWeight: 700,
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
