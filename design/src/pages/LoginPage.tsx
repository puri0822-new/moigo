import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { loadFirebaseAuth } from '../lib/firebase';
import { FS, FW, RADIUS } from '../lib/tokens';
import Pressable from '../components/Pressable';

export default function LoginPage() {
  const { theme, mode, toggle } = useTheme();
  const { loginWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 구글 로그인 버튼을 누르기 전에 Firebase를 미리 받아 둔다
  useEffect(() => { loadFirebaseAuth().catch(() => {}); }, []);

  const handleEmailLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: theme.bg, color: theme.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', top: 20, right: 24 }}>
        <Pressable
          onClick={toggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: RADIUS.pill, border: `1px solid ${theme.border}`,
            cursor: 'pointer', fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted,
          }}
        >
          <span>{mode === 'dark' ? '🌙' : '☀️'}</span>
          <span>{mode === 'dark' ? '다크' : '라이트'}</span>
        </Pressable>
      </div>

      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 52, height: 52, borderRadius: RADIUS.lg, background: theme.ai,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: FS.heading, color: theme.aiText, fontWeight: FW.bold,
            margin: '0 auto 16px',
          }}>AI</div>
          <div style={{ fontSize: FS.display, fontWeight: FW.bold, letterSpacing: '-0.02em' }}>모이고</div>
          <div style={{ fontSize: FS.body, color: theme.textMuted, marginTop: 8 }}>
            AI가 함께하는 스마트 모의매매
          </div>
        </div>

        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: RADIUS.xl, padding: 32,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              style={{
                padding: '12px 16px', borderRadius: RADIUS.md,
                border: `1px solid ${theme.inputBorder}`,
                background: theme.panel2, color: theme.text,
                fontSize: FS.body, fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              style={{
                padding: '12px 16px', borderRadius: RADIUS.md,
                border: `1px solid ${theme.inputBorder}`,
                background: theme.panel2, color: theme.text,
                fontSize: FS.body, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <div style={{ textAlign: 'right', fontSize: FS.caption, color: theme.aiFg, cursor: 'pointer' }}>
              비밀번호 찾기
            </div>
          </div>

          {error && (
            <div style={{ fontSize: FS.caption, color: theme.down, textAlign: 'center' }}>{error}</div>
          )}

          <button
            onClick={handleEmailLogin}
            disabled={submitting}
            style={{
              padding: '12px 0', borderRadius: RADIUS.md,
              background: theme.ai, color: theme.aiText,
              fontSize: FS.title, fontWeight: FW.semibold, border: 'none',
              cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: theme.border }} />
            <span style={{ fontSize: FS.caption, color: theme.textMuted }}>또는</span>
            <div style={{ flex: 1, height: 1, background: theme.border }} />
          </div>

          <button
            onClick={handleGoogleLogin}
            style={{
              padding: '12px 0', borderRadius: RADIUS.md,
              background: theme.panel2, color: theme.text,
              fontSize: FS.body, fontWeight: FW.medium, border: `1px solid ${theme.border}`,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Google로 로그인
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: FS.body, color: theme.textMuted }}>
          계정이 없으신가요?{' '}
          <Pressable as="span"
            onClick={() => navigate('/signup')}
            style={{ color: theme.aiFg, fontWeight: FW.medium, cursor: 'pointer' }}
          >회원가입</Pressable>
        </div>
      </div>
    </div>
  );
}
