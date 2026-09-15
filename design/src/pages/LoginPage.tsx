import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { theme, mode, toggle } = useTheme();
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    await loginWithGoogle();
    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh', background: theme.bg, color: theme.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', top: 20, right: 24 }}>
        <div
          onClick={toggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 20, border: `1px solid ${theme.border}`,
            cursor: 'pointer', fontSize: 13, fontWeight: 600, color: theme.textMuted,
          }}
        >
          <span>{mode === 'dark' ? '🌙' : '☀️'}</span>
          <span>{mode === 'dark' ? '다크' : '라이트'}</span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: theme.ai,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: theme.bg, fontWeight: 800,
            margin: '0 auto 16px',
          }}>AI</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>모의투자</div>
          <div style={{ fontSize: 14, color: theme.textMuted, marginTop: 6 }}>
            AI가 함께하는 스마트 모의매매
          </div>
        </div>

        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 16, padding: 28,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              style={{
                padding: '11px 14px', borderRadius: 9,
                border: `1px solid ${theme.border}`,
                background: theme.panel2, color: theme.text,
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              style={{
                padding: '11px 14px', borderRadius: 9,
                border: `1px solid ${theme.border}`,
                background: theme.panel2, color: theme.text,
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <div style={{ textAlign: 'right', fontSize: 12, color: theme.ai, cursor: 'pointer' }}>
              비밀번호 찾기
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 0', borderRadius: 10,
              background: theme.ai, color: theme.bg,
              fontSize: 15, fontWeight: 700, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
            }}
          >
            로그인
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: theme.border }} />
            <span style={{ fontSize: 12, color: theme.textMuted }}>또는</span>
            <div style={{ flex: 1, height: 1, background: theme.border }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: '카카오로 로그인', bg: '#FEE500', color: '#000', onClick: () => navigate('/') },
              { label: '네이버로 로그인', bg: '#03C75A', color: '#fff', onClick: () => navigate('/') },
              { label: 'Google로 로그인', bg: theme.panel2, color: theme.text, onClick: handleGoogleLogin },
            ].map(({ label, bg, color, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                style={{
                  padding: '11px 0', borderRadius: 10, background: bg, color,
                  fontSize: 14, fontWeight: 600, border: `1px solid ${theme.border}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: theme.textMuted }}>
          계정이 없으신가요?{' '}
          <span style={{ color: theme.ai, fontWeight: 600, cursor: 'pointer' }}>회원가입</span>
        </div>
      </div>
    </div>
  );
}
