import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function SignupPage() {
  const { theme, mode, toggle } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [allAgreed, setAllAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  const [error, setError] = useState('');

  const handleAllAgree = (checked: boolean) => {
    setAllAgreed(checked);
    setTermsAgreed(checked);
    setPrivacyAgreed(checked);
    setMarketingAgreed(checked);
  };

  const handleIndividualAgree = (setter: (v: boolean) => void, value: boolean) => {
    setter(value);
    if (!value) setAllAgreed(false);
    else {
      const next = { terms: termsAgreed, privacy: privacyAgreed, marketing: marketingAgreed };
      if (setter === setTermsAgreed) next.terms = true;
      if (setter === setPrivacyAgreed) next.privacy = true;
      if (setter === setMarketingAgreed) next.marketing = true;
      if (next.terms && next.privacy && next.marketing) setAllAgreed(true);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!email || !password || !passwordConfirm || !nickname) {
      setError('모든 필드를 입력해주세요'); return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다'); return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다'); return;
    }
    if (!termsAgreed || !privacyAgreed) {
      setError('필수 약관에 동의해주세요'); return;
    }

    try {
      const res = await fetch('http://localhost:8000/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname, marketing_agreed: marketingAgreed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || '회원가입에 실패했습니다'); return;
      }
      navigate('/login');
    } catch {
      setError('서버 연결에 실패했습니다');
    }
  };

  const inputStyle = {
    padding: '11px 14px', borderRadius: 9,
    border: `1px solid ${theme.border}`,
    background: theme.panel2, color: theme.text,
    fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%',
    boxSizing: 'border-box' as const,
  };

  const checkRowStyle = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 0', cursor: 'pointer', fontSize: 13,
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

      <div style={{ width: '100%', maxWidth: 400, padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: theme.ai,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: theme.bg, fontWeight: 800,
            margin: '0 auto 16px',
          }}>AI</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>회원가입</div>
          <div style={{ fontSize: 14, color: theme.textMuted, marginTop: 6 }}>
            모이고와 함께 스마트한 모의투자를 시작하세요
          </div>
        </div>

        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 16, padding: 28,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* 이메일 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              style={inputStyle}
            />
          </div>

          {/* 비밀번호 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8자 이상 입력하세요"
              style={inputStyle}
            />
          </div>

          {/* 비밀번호 확인 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted }}>비밀번호 확인</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호를 다시 입력하세요"
              style={{
                ...inputStyle,
                borderColor: passwordConfirm && password !== passwordConfirm ? '#ef4444' : theme.border,
              }}
            />
            {passwordConfirm && password !== passwordConfirm && (
              <span style={{ fontSize: 12, color: '#ef4444' }}>비밀번호가 일치하지 않습니다</span>
            )}
          </div>

          {/* 닉네임 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted }}>닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              style={inputStyle}
            />
          </div>

          {/* 약관 동의 */}
          <div style={{
            border: `1px solid ${theme.border}`, borderRadius: 10,
            padding: '4px 14px', marginTop: 4,
          }}>
            {/* 전체 동의 */}
            <div
              onClick={() => handleAllAgree(!allAgreed)}
              style={{ ...checkRowStyle, fontWeight: 700, borderBottom: `1px solid ${theme.border}` }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                border: `2px solid ${allAgreed ? theme.ai : theme.border}`,
                background: allAgreed ? theme.ai : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {allAgreed && <span style={{ color: theme.bg, fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
              전체 동의
            </div>

            {/* 서비스 이용약관 */}
            <div
              onClick={() => handleIndividualAgree(setTermsAgreed, !termsAgreed)}
              style={checkRowStyle}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                border: `2px solid ${termsAgreed ? theme.ai : theme.border}`,
                background: termsAgreed ? theme.ai : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {termsAgreed && <span style={{ color: theme.bg, fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{ flex: 1 }}>서비스 이용약관 동의 <span style={{ color: '#ef4444' }}>(필수)</span></span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>보기</span>
            </div>

            {/* 개인정보 수집 */}
            <div
              onClick={() => handleIndividualAgree(setPrivacyAgreed, !privacyAgreed)}
              style={checkRowStyle}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                border: `2px solid ${privacyAgreed ? theme.ai : theme.border}`,
                background: privacyAgreed ? theme.ai : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {privacyAgreed && <span style={{ color: theme.bg, fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{ flex: 1 }}>개인정보 수집 및 이용 동의 <span style={{ color: '#ef4444' }}>(필수)</span></span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>보기</span>
            </div>

            {/* 마케팅 수신 */}
            <div
              onClick={() => handleIndividualAgree(setMarketingAgreed, !marketingAgreed)}
              style={checkRowStyle}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                border: `2px solid ${marketingAgreed ? theme.ai : theme.border}`,
                background: marketingAgreed ? theme.ai : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {marketingAgreed && <span style={{ color: theme.bg, fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{ flex: 1 }}>마케팅 수신 동의 <span style={{ color: theme.textMuted }}>(선택)</span></span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>보기</span>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div style={{ fontSize: 13, color: '#ef4444', textAlign: 'center' }}>{error}</div>
          )}

          {/* 회원가입 버튼 */}
          <button
            onClick={handleSubmit}
            style={{
              padding: '12px 0', borderRadius: 10,
              background: theme.ai, color: theme.bg,
              fontSize: 15, fontWeight: 700, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
            }}
          >
            회원가입
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: theme.textMuted }}>
          이미 계정이 있으신가요?{' '}
          <span
            onClick={() => navigate('/login')}
            style={{ color: theme.ai, fontWeight: 600, cursor: 'pointer' }}
          >
            로그인
          </span>
        </div>
      </div>
    </div>
  );
}
