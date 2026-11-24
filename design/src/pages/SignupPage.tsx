import { useId, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { NICKNAME_MAX, PASSWORD_MAX, PASSWORD_MIN, signup } from '../lib/api';
import { FS, FW, RADIUS } from '../lib/tokens';

type Field = 'email' | 'password' | 'passwordConfirm' | 'nickname' | 'terms';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 칸별 검사. 오류 문구는 "무엇이 왜 잘못됐고 어떻게 고치는지"를 적는다
function validate(v: { email: string; password: string; passwordConfirm: string; nickname: string; termsAgreed: boolean; privacyAgreed: boolean }) {
  const errors: Partial<Record<Field, string>> = {};
  if (!v.email) errors.email = '이메일을 입력해 주세요';
  else if (!EMAIL_RE.test(v.email)) errors.email = '이메일 형식이 아니에요. 예: name@example.com';
  if (!v.password) errors.password = '비밀번호를 입력해 주세요';
  else if (v.password.length < PASSWORD_MIN) errors.password = `${PASSWORD_MIN - v.password.length}자 더 입력해 주세요 (${PASSWORD_MIN}~${PASSWORD_MAX}자)`;
  if (!v.passwordConfirm) errors.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요';
  else if (v.password !== v.passwordConfirm) errors.passwordConfirm = '위에 입력한 비밀번호와 달라요';
  if (!v.nickname.trim()) errors.nickname = '닉네임을 입력해 주세요';
  if (!v.termsAgreed || !v.privacyAgreed) errors.terms = '필수 약관 두 가지에 동의해야 가입할 수 있어요';
  return errors;
}

export default function SignupPage() {
  const { theme, mode, toggle } = useTheme();
  const navigate = useNavigate();
  const ids = { email: useId(), password: useId(), passwordConfirm: useId(), nickname: useId() };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  // 한 번 건드린 칸(또는 가입 버튼을 누른 뒤)부터 오류를 보여준다. 타이핑 시작하자마자 빨간 글씨가 뜨지 않게
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<{ field: Field | null; message: string } | null>(null);

  const allAgreed = termsAgreed && privacyAgreed && marketingAgreed;
  const errors = validate({ email, password, passwordConfirm, nickname, termsAgreed, privacyAgreed });
  const shown = (f: Field) => (submitted || touched[f]) ? errors[f] : undefined;
  const fieldError = (f: Field) => shown(f) ?? (serverError?.field === f ? serverError.message : undefined);
  const touch = (f: Field) => setTouched(t => ({ ...t, [f]: true }));

  const handleAllAgree = (checked: boolean) => {
    setTermsAgreed(checked);
    setPrivacyAgreed(checked);
    setMarketingAgreed(checked);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) {
      // 첫 번째 문제 칸으로 바로 이동시켜 어디를 고쳐야 하는지 찾지 않게 한다
      const first = (['email', 'password', 'passwordConfirm', 'nickname'] as const).find(f => errors[f]);
      if (first) document.getElementById(ids[first])?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await signup({ email, password, nickname: nickname.trim(), marketing_agreed: marketingAgreed });
      navigate('/login');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      // fetch 자체가 실패하면(서버 꺼짐 등) 브라우저 영어 문구가 오므로 바꿔서 보여준다
      const message = !raw || err instanceof TypeError
        ? '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요'
        : raw;
      // 서버가 알려준 문제를 해당 칸 아래에 붙인다 (예: 이미 사용 중인 이메일)
      const field = message.includes('이메일') ? 'email' as const
        : message.includes('비밀번호') ? 'password' as const
          : message.includes('닉네임') ? 'nickname' as const : null;
      setServerError({ field, message });
      if (field) document.getElementById(ids[field])?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (hasError: boolean): CSSProperties => ({
    padding: '12px 16px', borderRadius: RADIUS.md,
    border: `1px solid ${hasError ? theme.error : theme.inputBorder}`,
    background: theme.panel2, color: theme.text,
    fontSize: FS.body, fontFamily: 'inherit', width: '100%',
    boxSizing: 'border-box',
  });

  const labelStyle: CSSProperties = { fontSize: FS.caption, fontWeight: FW.medium, color: theme.text };

  // 입력칸 + 라벨 + (오류 또는 도움말). 오류는 칸 바로 아래, 아이콘과 문장으로 표시
  const field = (f: Exclude<Field, 'terms'>, label: string, input: ReactNode, hint?: ReactNode) => {
    const err = fieldError(f);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor={ids[f]} style={labelStyle}>{label}</label>
        {input}
        {err ? (
          <span id={`${ids[f]}-msg`} role="alert" style={{ fontSize: FS.caption, color: theme.error }}>⚠ {err}</span>
        ) : hint ? (
          <span id={`${ids[f]}-msg`} style={{ fontSize: FS.caption, color: theme.textMuted }}>{hint}</span>
        ) : null}
      </div>
    );
  };

  const describe = (f: Exclude<Field, 'terms'>) => ({
    'aria-invalid': !!fieldError(f),
    'aria-describedby': `${ids[f]}-msg`,
  });

  const checkRow = (checked: boolean, onChange: (v: boolean) => void, children: ReactNode, strong = false) => (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer',
      fontSize: FS.body, fontWeight: strong ? FW.semibold : undefined,
    }}>
      <input
        type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 18, height: 18, margin: 0, accentColor: theme.ai, flexShrink: 0, cursor: 'pointer' }}
      />
      <span style={{ flex: 1 }}>{children}</span>
    </label>
  );

  const pwLengthOk = password.length >= PASSWORD_MIN;

  return (
    <div style={{
      minHeight: '100vh', background: theme.bg, color: theme.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', top: 20, right: 24 }}>
        <button
          type="button"
          onClick={toggle}
          aria-label={mode === 'dark' ? '라이트 모드로 바꾸기' : '다크 모드로 바꾸기'}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: RADIUS.pill, border: `1px solid ${theme.border}`,
            fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted,
          }}
        >
          <span aria-hidden="true">{mode === 'dark' ? '🌙' : '☀️'}</span>
          <span>{mode === 'dark' ? '다크' : '라이트'}</span>
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: 400, padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div aria-hidden="true" style={{
            width: 52, height: 52, borderRadius: RADIUS.lg, background: theme.ai,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: FS.heading, color: theme.aiText, fontWeight: FW.bold,
            margin: '0 auto 16px',
          }}>AI</div>
          <h1 style={{ fontSize: FS.display, fontWeight: FW.bold, letterSpacing: '-0.02em' }}>회원가입</h1>
          <div style={{ fontSize: FS.body, color: theme.textMuted, marginTop: 8 }}>
            모이고와 함께 스마트한 모의투자를 시작하세요
          </div>
        </div>

        <form
          noValidate
          onSubmit={handleSubmit}
          style={{
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: RADIUS.xl, padding: 32,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}
        >
          {field('email', '이메일',
            <input
              id={ids.email} type="email" autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (serverError?.field === 'email') setServerError(null); }}
              onBlur={() => email && touch('email')}
              placeholder="name@example.com"
              style={inputStyle(!!fieldError('email'))}
              {...describe('email')}
            />,
          )}

          {field('password', '비밀번호',
            <input
              id={ids.password} type="password" autoComplete="new-password" maxLength={PASSWORD_MAX}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onBlur={() => password && touch('password')}
              style={inputStyle(!!fieldError('password'))}
              {...describe('password')}
            />,
            // 조건을 입력 전부터 보여주고, 채우면 바로 체크 표시로 알려준다
            <span style={{ color: pwLengthOk ? theme.success : theme.textMuted }}>
              {pwLengthOk ? '✓' : '·'} {PASSWORD_MIN}~{PASSWORD_MAX}자 ({password.length}자 입력)
            </span>,
          )}

          {field('passwordConfirm', '비밀번호 확인',
            <input
              id={ids.passwordConfirm} type="password" autoComplete="new-password" maxLength={PASSWORD_MAX}
              value={passwordConfirm}
              onChange={e => { setPasswordConfirm(e.target.value); if (e.target.value.length >= password.length) touch('passwordConfirm'); }}
              onBlur={() => passwordConfirm && touch('passwordConfirm')}
              style={inputStyle(!!fieldError('passwordConfirm'))}
              {...describe('passwordConfirm')}
            />,
            passwordConfirm && password === passwordConfirm
              ? <span style={{ color: theme.success }}>✓ 비밀번호가 일치해요</span>
              : undefined,
          )}

          {field('nickname', '닉네임',
            <input
              id={ids.nickname} type="text" autoComplete="nickname" maxLength={NICKNAME_MAX}
              value={nickname}
              onChange={e => { setNickname(e.target.value); if (serverError?.field === 'nickname') setServerError(null); }}
              onBlur={() => nickname && touch('nickname')}
              placeholder="랭킹과 커뮤니티에 보이는 이름"
              style={inputStyle(!!fieldError('nickname'))}
              {...describe('nickname')}
            />,
            `${NICKNAME_MAX}자까지 입력할 수 있어요`,
          )}

          {/* 약관 동의. 약관 본문 페이지가 아직 없어서, 눌러도 아무 일 없던 "보기"는 뺐다 */}
          <fieldset style={{
            border: `1px solid ${fieldError('terms') ? theme.error : theme.border}`, borderRadius: RADIUS.lg,
            padding: '4px 16px', margin: 0,
          }}>
            <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>약관 동의</legend>
            <div style={{ borderBottom: `1px solid ${theme.border}` }}>
              {checkRow(allAgreed, handleAllAgree, '전체 동의', true)}
            </div>
            {checkRow(termsAgreed, setTermsAgreed, <>서비스 이용약관 동의 <span style={{ color: theme.error }}>(필수)</span></>)}
            {checkRow(privacyAgreed, setPrivacyAgreed, <>개인정보 수집 및 이용 동의 <span style={{ color: theme.error }}>(필수)</span></>)}
            {checkRow(marketingAgreed, setMarketingAgreed, <>마케팅 수신 동의 <span style={{ color: theme.textMuted }}>(선택)</span></>)}
          </fieldset>
          {fieldError('terms') && (
            <span role="alert" style={{ fontSize: FS.caption, color: theme.error, marginTop: -8 }}>⚠ {fieldError('terms')}</span>
          )}

          {/* 칸에 붙일 수 없는 오류(서버 연결 실패 등) */}
          {serverError && serverError.field == null && (
            <div role="alert" style={{
              fontSize: FS.body, color: theme.error, background: theme.errorSoft,
              borderRadius: RADIUS.md, padding: '12px 12px',
            }}>⚠ {serverError.message}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '12px 0', borderRadius: RADIUS.md,
              background: theme.ai, color: theme.aiText,
              fontSize: FS.title, fontWeight: FW.semibold, marginTop: 4,
              opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? '가입 중…' : '회원가입'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: FS.body, color: theme.textMuted }}>
          이미 계정이 있으신가요?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{ color: theme.aiFg, fontWeight: FW.semibold, textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            로그인
          </button>
        </div>
      </div>
    </div>
  );
}
