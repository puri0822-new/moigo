import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useViewport } from '../lib/useViewport';
import { loadFirebaseAuth } from '../lib/firebase';
import { FS, FW, RADIUS, ON_BRAND, BRAND_GRADIENT } from '../lib/tokens';
import Pressable from '../components/Pressable';

function LoginModal({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const { loginWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 구글 로그인 버튼을 누르기 전에 Firebase를 미리 받아 둔다
  useEffect(() => { loadFirebaseAuth().catch(() => {}); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400, margin: '0 24px',
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: RADIUS.xl, padding: 32,
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: RADIUS.md,
              background: BRAND_GRADIENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
                <polyline points="8,48 22,36 32,41 44,22" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="44" cy="22" r="6" fill="white" opacity="0.3"/>
                <circle cx="44" cy="22" r="4" fill="white"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: FS.title, fontWeight: FW.bold }}>모이고 로그인</div>
              <div style={{ fontSize: FS.caption, color: theme.textMuted }}>AI 모의매매 시작하기</div>
            </div>
          </div>
          <Pressable
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 30, height: 30, borderRadius: RADIUS.md,
              background: theme.panel2, border: `1px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: FS.body, color: theme.textMuted,
            }}
          >✕</Pressable>
        </div>

        {/* 이메일 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted }}>이메일</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="이메일을 입력하세요"
            onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
            style={{
              padding: '12px 16px', borderRadius: RADIUS.md,
              border: `1px solid ${theme.inputBorder}`,
              background: theme.panel2, color: theme.text,
              fontSize: FS.body, fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        {/* 비밀번호 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted }}>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
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
            background: BRAND_GRADIENT,
            color: '#fff', fontSize: FS.title, fontWeight: FW.semibold,
            border: 'none', cursor: submitting ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: submitting ? 0.7 : 1,
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

        <div style={{ textAlign: 'center', fontSize: FS.body, color: theme.textMuted }}>
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

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'AI 실시간 분석',
    desc: '여러 AI 봇이 종목을 분석하고 매수·매도 시그널을 실시간으로 제공합니다.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    title: '리스크 없는 모의매매',
    desc: '가상 현금으로 실제 시장과 동일하게 매수·매도를 경험해보세요.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: '실시간 랭킹',
    desc: '다른 투자자들과 수익률을 비교하고 상위 트레이더의 전략을 참고하세요.',
  },
];

// AI 분석 페이지 캡처(라이트 테마). 추천·성적표가 아직 더미 데이터라 API가 붙으면 다시 찍어 교체한다
const aiPreviews = [
  {
    src: '/screenshots/ai-stats.webp',
    label: 'AI 성적',
    title: 'AI 성적을 숫자로 공개합니다',
    desc: 'AI마다 적중률과 평균 수익, 최근 결과를 보여주고 주별 적중률 추이까지 비교할 수 있어요.',
    alt: 'AI별 적중률 카드와 적중률 추이 차트',
  },
  {
    src: '/screenshots/ai-picks.webp',
    label: '추천 종목',
    title: '매일 새로운 추천 종목',
    desc: 'AI가 뉴스를 분석해 매수·매도 종목을 고르고, 근거와 추천가, 결과 공개일을 함께 알려줘요.',
    alt: 'AI별 추천 종목 카드',
  },
  {
    src: '/screenshots/ai-history.webp',
    label: '성적표',
    title: '지난 추천도 결과까지 확인',
    desc: '1주·1달 뒤 실제 가격으로 적중 여부를 가려, 지난 추천의 수익률을 모두 남겨둬요.',
    alt: '지난 추천 성적표',
    fade: true,
  },
];

export default function LandingPage() {
  const { theme, mode, toggle } = useTheme();
  const { isMobile } = useViewport();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text }}>
      {/* 상단 네비 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 40px', height: 64,
        borderBottom: `1px solid ${theme.border}`,
        background: theme.panel,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: FW.bold, fontSize: FS.title }}>
          <div style={{
            width: 28, height: 28, borderRadius: RADIUS.md,
            background: BRAND_GRADIENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
              <polyline points="8,48 22,36 32,41 44,22" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="44" cy="22" r="6" fill="white" opacity="0.3"/>
              <circle cx="44" cy="22" r="4" fill="white"/>
            </svg>
          </div>
          모이고
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Pressable
            onClick={toggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: RADIUS.pill, border: `1px solid ${theme.border}`,
              cursor: 'pointer', fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted,
            }}
          >
            <span>{mode === 'dark' ? '🌙' : '☀️'}</span>
            {!isMobile && <span>{mode === 'dark' ? '다크' : '라이트'}</span>}
          </Pressable>
          <Pressable
            onClick={() => setShowLogin(true)}
            style={{
              padding: isMobile ? '8px 16px' : '8px 20px', borderRadius: RADIUS.md,
              background: BRAND_GRADIENT,
              color: '#fff', fontSize: FS.body, fontWeight: FW.semibold, cursor: 'pointer',
            }}
          >
            로그인
          </Pressable>
        </div>
      </div>

      {/* 히어로 섹션 */}
      <div style={{
        background: BRAND_GRADIENT,
        padding: isMobile ? '48px 20px' : '80px 40px',
        display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 32 : 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -60, top: -60, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', right: 120, bottom: -80, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', left: '50%', top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 520 }}>
          <div style={{ fontSize: FS.body, fontWeight: FW.medium, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', marginBottom: 16 }}>
            ✦ AI-Powered Mock Trading Platform
          </div>
          <div style={{ fontSize: isMobile ? FS.display : 42, fontWeight: FW.bold, color: '#fff', lineHeight: 1.25, marginBottom: 20, letterSpacing: '-0.02em' }}>
            AI가 분석하고,<br />내가 결정하는<br />모의매매
          </div>
          <div style={{ fontSize: isMobile ? FS.body : FS.title, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, marginBottom: isMobile ? 32 : 40 }}>
            실제 시장 데이터 기반으로 AI와 함께<br />리스크 없이 투자 전략을 연습해보세요.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Pressable
              onClick={() => setShowLogin(true)}
              style={{
                padding: isMobile ? '12px 24px' : '16px 32px', borderRadius: RADIUS.lg,
                background: '#fff', color: '#4361ee',
                fontSize: FS.title, fontWeight: FW.bold, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              }}
            >
              지금 시작하기 →
            </Pressable>
            <Pressable
              onClick={() => setShowLogin(true)}
              style={{
                padding: isMobile ? '12px 24px' : '16px 32px', borderRadius: RADIUS.lg,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', fontSize: FS.title, fontWeight: FW.medium, cursor: 'pointer',
              }}
            >
              로그인
            </Pressable>
          </div>
        </div>

        {/* 우측 비교 차트 카드 */}
        <div style={{ position: 'relative', zIndex: 1, flexShrink: 0, display: 'flex', gap: 12 }}>
          {/* 일반 매매 */}
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: RADIUS.lg, padding: isMobile ? '16px' : '20px 24px',
            ...(isMobile ? { flex: '1 1 0', minWidth: 0 } : { width: 190 }),
          }}>
            <div style={{ fontSize: FS.caption, color: 'rgba(255,255,255,0.5)', fontWeight: FW.semibold, letterSpacing: '0.06em', marginBottom: 12 }}>일반 매매</div>
            <div style={{ fontSize: FS.display, fontWeight: FW.bold, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>+8.2%</div>
            <svg width={isMobile ? '100%' : 146} height="80" viewBox="0 0 146 80" preserveAspectRatio="none" fill="none" style={{ display: 'block' }}>
              <line x1="0" y1="60" x2="146" y2="60" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <line x1="0" y1="40" x2="146" y2="40" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <line x1="0" y1="20" x2="146" y2="20" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <polyline
                points="0,70 24,64 49,58 73,54 98,50 122,46 146,42"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="146" cy="42" r="3.5" fill="rgba(255,255,255,0.4)" />
            </svg>
          </div>

          {/* 모이고 사용 시 */}
          <div style={{
            background: `${ON_BRAND.up}1f`,
            backdropFilter: 'blur(8px)',
            border: `1px solid ${ON_BRAND.up}4d`,
            borderRadius: RADIUS.lg, padding: isMobile ? '16px' : '20px 24px',
            ...(isMobile ? { flex: '1 1 0', minWidth: 0 } : { width: 190 }),
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
              <div style={{ fontSize: FS.caption, color: 'rgba(255,255,255,0.7)', fontWeight: FW.semibold, letterSpacing: '0.06em' }}>모이고 사용 시</div>
              <div style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: ON_BRAND.up, background: `${ON_BRAND.up}33`, border: `1px solid ${ON_BRAND.up}66`, borderRadius: RADIUS.sm, padding: '2px 4px' }}>✦ moigo</div>
            </div>
            <div style={{ fontSize: FS.display, fontWeight: FW.bold, color: ON_BRAND.up, marginBottom: 16 }}>+24.3%</div>
            <svg width={isMobile ? '100%' : 146} height="80" viewBox="0 0 146 80" preserveAspectRatio="none" fill="none" style={{ display: 'block' }}>
              <line x1="0" y1="60" x2="146" y2="60" stroke={`${ON_BRAND.up}26`} strokeWidth="1" />
              <line x1="0" y1="40" x2="146" y2="40" stroke={`${ON_BRAND.up}26`} strokeWidth="1" />
              <line x1="0" y1="20" x2="146" y2="20" stroke={`${ON_BRAND.up}26`} strokeWidth="1" />
              <polyline
                points="0,70 24,58 49,46 73,34 98,22 122,12 146,4"
                fill="none"
                stroke={ON_BRAND.up}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="146" cy="4" r="4.5" fill={ON_BRAND.up} />
              <circle cx="146" cy="4" r="9" fill={ON_BRAND.up} opacity="0.2" />
            </svg>
          </div>
        </div>
      </div>

      {/* AI 분석 화면 미리보기 */}
      <div style={{ padding: '80px 40px 8px', maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: theme.aiFg, letterSpacing: '0.1em', marginBottom: 12 }}>AI ANALYSIS</div>
          <div style={{ fontSize: FS.display, fontWeight: FW.bold, letterSpacing: '-0.02em' }}>AI가 고르고, 결과로 증명합니다</div>
          <div style={{ fontSize: FS.caption, color: theme.textMuted, marginTop: 12 }}>01~03 화면의 추천 종목과 성적은 예시이고, 04는 실제 AI 추천 화면입니다</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 80 }}>
          {aiPreviews.map((p, i) => (
            <div key={p.src} style={{
              display: 'flex', alignItems: 'center', gap: 48,
              flexDirection: i % 2 === 1 ? 'row-reverse' : 'row',
            }}>
              <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  alignSelf: 'flex-start', fontSize: FS.caption, fontWeight: FW.semibold, color: theme.aiFg,
                  background: theme.aiSoft, borderRadius: RADIUS.pill, padding: '4px 12px',
                }}>
                  {String(i + 1).padStart(2, '0')} · {p.label}
                </div>
                <div style={{ fontSize: FS.heading, fontWeight: FW.bold, lineHeight: 1.35, letterSpacing: '-0.02em' }}>{p.title}</div>
                <div style={{ fontSize: FS.body, color: theme.textMuted, lineHeight: 1.7 }}>{p.desc}</div>
              </div>
              <div style={{
                flex: 1, minWidth: 0, borderRadius: RADIUS.xl, overflow: 'hidden',
                border: `1px solid ${theme.border}`, background: theme.panel,
                boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
              }}>
                <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${theme.border}` }}>
                  {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <img
                  src={p.src}
                  alt={p.alt}
                  loading="lazy"
                  style={{
                    display: 'block', width: '100%', height: 'auto',
                    // 성적표는 중간에서 잘리므로 아래를 흐리게 해 목록이 이어지는 것처럼 보이게 한다
                    ...(p.fade && {
                      maskImage: 'linear-gradient(to bottom, #000 70%, transparent)',
                      WebkitMaskImage: 'linear-gradient(to bottom, #000 70%, transparent)',
                    }),
                  }}
                />
              </div>
            </div>
          ))}

          {/* 04: 추천 상세 오버레이와 종목 AI 인사이트. 세로로 긴 화면이라 브라우저 틀 없이 카드 두 장을 나란히 띄운다 (실제 추천으로 캡처) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 48, flexDirection: 'row-reverse' }}>
            <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                alignSelf: 'flex-start', fontSize: FS.caption, fontWeight: FW.semibold, color: theme.aiFg,
                background: theme.aiSoft, borderRadius: RADIUS.pill, padding: '4px 12px',
              }}>
                04 · 판단 근거
              </div>
              <div style={{ fontSize: FS.heading, fontWeight: FW.bold, lineHeight: 1.35, letterSpacing: '-0.02em' }}>왜 그렇게 봤는지까지 공개합니다</div>
              <div style={{ fontSize: FS.body, color: theme.textMuted, lineHeight: 1.7 }}>
                추천을 누르면 AI가 읽은 실제 뉴스와 판단 이유가 나오고, 종목마다 오늘 왜 올랐는지·내렸는지와 AI들의 의견을 한눈에 볼 수 있어요.
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 20 }}>
              {[
                { src: '/screenshots/ai-detail.webp', alt: 'AI 추천 상세: 추천 이유와 근거 뉴스', fade: false },
                { src: '/screenshots/ai-insight.webp', alt: '종목 AI 인사이트: 오늘 등락 이유와 AI별 코멘트', fade: true },
              ].map(img => (
                <img
                  key={img.src}
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                  style={{
                    display: 'block', height: 480, width: 'auto', maxWidth: '100%', borderRadius: RADIUS.xl,
                    border: `1px solid ${theme.border}`, boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
                    ...(img.fade && {
                      maskImage: 'linear-gradient(to bottom, #000 75%, transparent)',
                      WebkitMaskImage: 'linear-gradient(to bottom, #000 75%, transparent)',
                    }),
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 기능 소개 */}
      <div style={{ padding: isMobile ? '48px 16px' : '64px 40px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: theme.aiFg, letterSpacing: '0.1em', marginBottom: 12 }}>FEATURES</div>
          <div style={{ fontSize: FS.display, fontWeight: FW.bold, letterSpacing: '-0.02em' }}>모이고가 특별한 이유</div>
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 12 : 20, flexDirection: isMobile ? 'column' : 'row' }}>
          {features.map(f => (
            <div key={f.title} style={{
              flex: 1,
              background: theme.panel, border: `1px solid ${theme.border}`,
              borderRadius: RADIUS.xl, padding: '32px 24px',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: RADIUS.lg,
                background: theme.aiSoft, color: theme.aiFg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {f.icon}
              </div>
              <div style={{ fontSize: FS.title, fontWeight: FW.bold }}>{f.title}</div>
              <div style={{ fontSize: FS.body, color: theme.textMuted, lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 CTA */}
      <div style={{
        margin: isMobile ? '0 16px 48px' : '0 40px 64px',
        background: BRAND_GRADIENT,
        borderRadius: RADIUS.xl, padding: isMobile ? '40px 20px' : '48px 40px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', left: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', right: -20, bottom: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: FS.display, fontWeight: FW.bold, color: '#fff', marginBottom: 12 }}>지금 바로 시작해보세요</div>
          <div style={{ fontSize: FS.body, color: 'rgba(255,255,255,0.75)', marginBottom: 32 }}>무료로 가입하고 AI 모의매매를 경험해보세요.</div>
          <Pressable
            onClick={() => setShowLogin(true)}
            style={{
              display: 'inline-block',
              padding: '16px 40px', borderRadius: RADIUS.lg,
              background: '#fff', color: '#4361ee',
              fontSize: FS.title, fontWeight: FW.bold, cursor: 'pointer',
            }}
          >
            무료로 시작하기
          </Pressable>
        </div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
