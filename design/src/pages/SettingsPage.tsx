import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPatch, apiPost, apiPut, deleteAvatar, uploadAvatar, type MyProfile } from '../lib/api';
import UserAvatar from '../components/UserAvatar';

const NICKNAME_MAX = 50;
const PASSWORD_MIN = 8;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const errorText = (err: unknown) => (err instanceof Error ? err.message : '요청에 실패했습니다');

export default function SettingsPage() {
  const { theme } = useTheme();
  const { updateNickname, updateAvatarUrl, logout } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadError, setLoadError] = useState('');

  const [nickname, setNickname] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState<Notice>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwNotice, setPwNotice] = useState<Notice>(null);
  const [savingPw, setSavingPw] = useState(false);

  const [alertNotice, setAlertNotice] = useState<Notice>(null);
  const [savingAlert, setSavingAlert] = useState(false);

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

  const onAvatarPick = async (file: File | undefined) => {
    if (!file) return;
    setAvatarNotice(null);
    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarNotice({ kind: 'error', text: 'JPG, PNG, WebP 사진만 올릴 수 있습니다' });
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarNotice({ kind: 'error', text: '프로필 사진은 2MB 이하만 올릴 수 있습니다' });
      return;
    }
    setSavingAvatar(true);
    try {
      const next = await uploadAvatar(file);
      setProfile(next);
      updateAvatarUrl(next.avatar_url);
      setAvatarNotice({ kind: 'ok', text: '프로필 사진을 올렸습니다' });
    } catch (err) {
      setAvatarNotice({ kind: 'error', text: errorText(err) });
    } finally {
      setSavingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setSavingAvatar(true);
    setAvatarNotice(null);
    try {
      const res = await deleteAvatar();
      setProfile(res.data);
      updateAvatarUrl(null);
      setAvatarNotice({ kind: 'ok', text: '프로필 사진을 삭제했습니다' });
    } catch (err) {
      setAvatarNotice({ kind: 'error', text: errorText(err) });
    } finally {
      setSavingAvatar(false);
    }
  };

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

  // 스위치는 누르는 즉시 저장한다
  const togglePriceAlert = async () => {
    if (savingAlert) return;
    const next = !profile.price_alert_enabled;
    setSavingAlert(true);
    setAlertNotice(null);
    try {
      const res = await apiPatch<MyProfile>('/users/me', { price_alert_enabled: next });
      setProfile(res.data);
      setAlertNotice({ kind: 'ok', text: next ? '급등락 알림을 켰습니다' : '급등락 알림을 껐습니다' });
    } catch (err) {
      setAlertNotice({ kind: 'error', text: errorText(err) });
    } finally {
      setSavingAlert(false);
    }
  };

  const joined = new Date(profile.created_at);
  const joinedDays = Math.floor((Date.now() - joined.getTime()) / 86_400_000) + 1;

  const badgeStyle = {
    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
  };

  return (
    <div style={{
      padding: 24, maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 12px 6px 8px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
          background: theme.panel, border: `1px solid ${theme.border}`, color: theme.textMuted,
          fontSize: 13, fontWeight: 600,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        홈으로
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>회원 설정</div>
        <div style={{ fontSize: 13, color: theme.textMuted }}>프로필과 비밀번호, 알림을 관리합니다</div>
      </div>

      {/* 대시보드 소개 배너와 같은 그라데이션 */}
      <div style={{
        background: 'linear-gradient(135deg, #4F6EF7 0%, #7B5EA7 60%, #3B4FC8 100%)', borderRadius: 16,
        padding: '28px 28px', display: 'flex', alignItems: 'center', gap: 18,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', right: 90, bottom: -70, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <UserAvatar name={profile.nickname} avatarUrl={profile.avatar_url} size={72} />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.nickname}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.email}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            <span style={badgeStyle}>{profile.login_type === 'GOOGLE' ? 'Google' : '이메일'}</span>
            <span style={badgeStyle}>
              {joined.getFullYear()}.{joined.getMonth() + 1}.{joined.getDate()} 가입 · {joinedDays}일째
            </span>
          </div>
        </div>
      </div>

      <Section title="프로필" icon="user" description="다른 사용자에게 보이는 이름과 사진, 수신 동의">
        <Field label="프로필 사진">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <UserAvatar name={profile.nickname} avatarUrl={profile.avatar_url} size={56} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={savingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  style={buttonStyle(!savingAvatar)}
                >
                  {profile.avatar_url ? '사진 바꾸기' : '사진 올리기'}
                </button>
                {profile.avatar_url && (
                  <button
                    type="button"
                    disabled={savingAvatar}
                    onClick={removeAvatar}
                    style={{
                      ...buttonStyle(!savingAvatar),
                      background: 'transparent', color: theme.textMuted,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>JPG, PNG, WebP · 2MB 이하</div>
              {notice(avatarNotice)}
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={e => onAvatarPick(e.target.files?.[0])}
          />
        </Field>
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
        <Section title="비밀번호 변경" icon="lock" description="이메일 로그인에 쓰는 비밀번호">
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

      <Section title="알림 설정" icon="bell" description="관심 종목 가격 변동 알림">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>관심 종목 급등락 알림</div>
            <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
              알림을 켠 관심 종목이 전일 종가 대비 5%, 10%, 15%… 를 넘게 오르거나 내리면 오른쪽 위 알림에 표시합니다.
              끄면 종목별 알림 설정과 관계없이 새 알림을 보내지 않습니다.
            </div>
          </div>
          <div
            role="switch"
            aria-checked={profile.price_alert_enabled}
            onClick={togglePriceAlert}
            style={{
              width: 44, height: 26, borderRadius: 13, flexShrink: 0, position: 'relative',
              background: profile.price_alert_enabled ? theme.ai : theme.border,
              cursor: savingAlert ? 'default' : 'pointer', opacity: savingAlert ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: profile.price_alert_enabled ? 21 : 3,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s',
            }} />
          </div>
        </div>
        {notice(alertNotice)}
      </Section>

      <Section title="회원 탈퇴" icon="alert" description="계정과 모든 데이터 삭제" danger>
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

const ICON_PATHS = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4h4',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v4m0 3v.01',
};

interface SectionProps {
  title: string;
  icon: keyof typeof ICON_PATHS;
  description: string;
  danger?: boolean;
  children: ReactNode;
}

function Section({ title, icon, description, danger, children }: SectionProps) {
  const { theme } = useTheme();
  const accent = danger ? '#ef4444' : theme.ai;
  return (
    <div style={{
      background: theme.panel, border: `1px solid ${danger ? 'rgba(239, 68, 68, 0.45)' : theme.border}`, borderRadius: 16,
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
        borderBottom: `1px solid ${danger ? 'rgba(239, 68, 68, 0.25)' : theme.border}`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: danger ? 'rgba(239, 68, 68, 0.12)' : theme.aiSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICON_PATHS[icon]} />
          </svg>
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: danger ? '#ef4444' : theme.text }}>{title}</div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>{description}</div>
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
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
