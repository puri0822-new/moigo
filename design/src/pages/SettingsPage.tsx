import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPatch, apiPost, apiPut } from '../lib/api';

interface MyProfile {
  email: string;
  nickname: string;
  login_type: string;
  has_password: boolean;
  marketing_agreed: boolean;
  created_at: string;
}

const NICKNAME_MAX = 50;
const PASSWORD_MIN = 8;

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const errorText = (err: unknown) => (err instanceof Error ? err.message : '요청에 실패했습니다');

export default function SettingsPage() {
  const { theme } = useTheme();
  const { updateNickname, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadError, setLoadError] = useState('');

  const [nickname, setNickname] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwNotice, setPwNotice] = useState<Notice>(null);
  const [savingPw, setSavingPw] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);

  useEffect(() => {
    apiGet<MyProfile>('/users/me')
      .then(res => {
        setProfile(res.data);
        setNickname(res.data.nickname);
        setMarketing(res.data.marketing_agreed);
      })
      .catch(err => setLoadError(errorText(err)));
  }, []);

  const inputStyle = {
    padding: '11px 14px', borderRadius: 9,
    border: `1px solid ${theme.border}`,
    background: theme.panel2, color: theme.text,
    fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%',
    boxSizing: 'border-box' as const,
  };

  const buttonStyle = (enabled: boolean) => ({
    padding: '10px 18px', borderRadius: 9, border: 'none', flexShrink: 0,
    background: theme.ai, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
    cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.45,
  });

  const notice = (n: Notice) => n && (
    <div style={{ fontSize: 12, fontWeight: 600, color: n.kind === 'ok' ? '#16a34a' : '#ef4444' }}>{n.text}</div>
  );

  if (loadError) {
    return <div style={{ padding: 24, fontSize: 13, color: theme.textMuted }}>회원 정보를 불러오지 못했습니다: {loadError}</div>;
  }
  if (!profile) {
    return <div style={{ padding: 24, fontSize: 13, color: theme.textMuted }}>불러오는 중…</div>;
  }

  const trimmedNickname = nickname.trim();
  const profileChanged = trimmedNickname !== profile.nickname || marketing !== profile.marketing_agreed;
  const canSaveProfile = profileChanged && trimmedNickname.length > 0 && !savingProfile;

  const saveProfile = async () => {
    if (!canSaveProfile) return;
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const res = await apiPatch<MyProfile>('/users/me', { nickname: trimmedNickname, marketing_agreed: marketing });
      setProfile(res.data);
      setNickname(res.data.nickname);
      updateNickname(res.data.nickname);
      setProfileNotice({ kind: 'ok', text: '저장했습니다' });
    } catch (err) {
      setProfileNotice({ kind: 'error', text: errorText(err) });
    } finally {
      setSavingProfile(false);
    }
  };

  const canChangePw = !!currentPw && !!newPw && !!confirmPw && !savingPw;
  const changePassword = async () => {
    if (!canChangePw) return;
    if (newPw.length < PASSWORD_MIN) { setPwNotice({ kind: 'error', text: `새 비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다` }); return; }
    if (newPw !== confirmPw) { setPwNotice({ kind: 'error', text: '새 비밀번호가 서로 다릅니다' }); return; }
    setSavingPw(true);
    setPwNotice(null);
    try {
      await apiPut('/users/me/password', { current_password: currentPw, new_password: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwNotice({ kind: 'ok', text: '비밀번호를 변경했습니다' });
    } catch (err) {
      setPwNotice({ kind: 'error', text: errorText(err) });
    } finally {
      setSavingPw(false);
    }
  };

  const joined = new Date(profile.created_at);

  return (
    <div style={{ padding: 24, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>회원 설정</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>
          {joined.getFullYear()}.{joined.getMonth() + 1}.{joined.getDate()} 가입 · {profile.login_type === 'GOOGLE' ? '구글 계정' : '이메일 계정'}
        </div>
      </div>

      <Section title="프로필">
        <Field label="이메일">
          <div style={{ ...inputStyle, color: theme.textMuted, background: 'transparent' }}>{profile.email}</div>
          <div style={{ fontSize: 11, color: theme.textMuted }}>이메일은 변경할 수 없습니다</div>
        </Field>
        <Field label="닉네임">
          <input
            value={nickname}
            maxLength={NICKNAME_MAX}
            onChange={e => { setNickname(e.target.value); setProfileNotice(null); }}
            onKeyDown={e => { if (e.key === 'Enter') saveProfile(); }}
            style={inputStyle}
          />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={marketing}
            onChange={e => { setMarketing(e.target.checked); setProfileNotice(null); }}
            style={{ width: 16, height: 16, accentColor: theme.ai }}
          />
          마케팅 정보 수신 동의
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
          {notice(profileNotice)}
          <button onClick={saveProfile} disabled={!canSaveProfile} style={buttonStyle(canSaveProfile)}>
            {savingProfile ? '저장 중…' : '저장'}
          </button>
        </div>
      </Section>

      {/* 구글로만 가입한 계정은 비밀번호가 없다 */}
      {profile.has_password && (
        <Section title="비밀번호 변경">
          <Field label="현재 비밀번호">
            <input type="password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); setPwNotice(null); }} style={inputStyle} />
          </Field>
          <Field label="새 비밀번호">
            <input
              type="password" value={newPw} placeholder={`${PASSWORD_MIN}자 이상 입력하세요`}
              onChange={e => { setNewPw(e.target.value); setPwNotice(null); }} style={inputStyle}
            />
          </Field>
          <Field label="새 비밀번호 확인">
            <input
              type="password" value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setPwNotice(null); }}
              onKeyDown={e => { if (e.key === 'Enter') changePassword(); }}
              style={inputStyle}
            />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
            {notice(pwNotice)}
            <button onClick={changePassword} disabled={!canChangePw} style={buttonStyle(canChangePw)}>
              {savingPw ? '변경 중…' : '비밀번호 변경'}
            </button>
          </div>
        </Section>
      )}

      <Section title="회원 탈퇴" danger>
        <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>
          탈퇴하면 모의투자 계좌, 보유 종목, 거래 내역, 피드에 쓴 글과 댓글이 모두 삭제되며 되돌릴 수 없습니다.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setWithdrawOpen(true)}
            style={{
              padding: '10px 18px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
              background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', fontSize: 13, fontWeight: 700,
            }}
          >
            탈퇴하기
          </button>
        </div>
      </Section>

      {withdrawOpen && (
        <WithdrawDialog
          profile={profile}
          inputStyle={inputStyle}
          onClose={() => setWithdrawOpen(false)}
          onDone={async () => { await logout(); navigate('/', { replace: true }); }}
        />
      )}
    </div>
  );
}

function Section({ title, danger, children }: { title: string; danger?: boolean; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <div style={{
      background: theme.panel, border: `1px solid ${danger ? 'rgba(239, 68, 68, 0.45)' : theme.border}`, borderRadius: 14,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: danger ? '#ef4444' : theme.text }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted }}>{label}</div>
      {children}
    </div>
  );
}

interface WithdrawDialogProps {
  profile: MyProfile;
  inputStyle: React.CSSProperties;
  onClose: () => void;
  onDone: () => Promise<void>;
}

// 실수로 탈퇴하지 않도록 닉네임을 직접 입력하게 하고, 비밀번호가 있는 계정은 비밀번호도 받는다
function WithdrawDialog({ profile, inputStyle, onClose, onDone }: WithdrawDialogProps) {
  const { theme } = useTheme();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const canSubmit = typed === profile.nickname && (!profile.has_password || !!password) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await apiPost('/users/me/withdraw', profile.has_password ? { password } : {});
      await onDone();
    } catch (err) {
      setError(errorText(err));
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={() => { if (!submitting) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400, margin: '0 24px',
          background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800 }}>정말 탈퇴할까요?</div>
        <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>
          계좌와 거래 내역, 피드 글이 모두 삭제되며 되돌릴 수 없습니다. 계속하려면 닉네임{' '}
          <span style={{ color: theme.text, fontWeight: 700 }}>{profile.nickname}</span>을(를) 입력하세요.
        </div>
        <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={profile.nickname} style={inputStyle} />
        {profile.has_password && (
          <input
            type="password" value={password} placeholder="비밀번호"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            style={inputStyle}
          />
        )}
        {error && <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              background: theme.panel2, border: `1px solid ${theme.border}`, color: theme.text, fontSize: 14, fontWeight: 600,
            }}
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', fontFamily: 'inherit',
              background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'default', opacity: canSubmit ? 1 : 0.45,
            }}
          >
            {submitting ? '탈퇴 중…' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
