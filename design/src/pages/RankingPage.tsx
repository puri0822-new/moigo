import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { apiGet } from '../lib/api';
import DemoBadge from '../components/DemoBadge';
import StockLogo from '../components/StockLogo';
import UserAvatar from '../components/UserAvatar';

interface ApiRankUser {
  rank: number;
  user_id: number;
  nickname: string;
  avatar_url: string | null;
  total_asset: number;
  profit_amount: number;
  profit_rate: number;
  top_holdings: { name: string; code: string; profit_rate: number }[];
  is_me: boolean;
  is_demo: boolean;
}

interface RankUser {
  id: number;
  nickname: string;
  avatarUrl: string | null;
  totalAsset: number;
  profitAmount: number;
  profitRate: number;
  top3: { name: string; code: string; profitRate: number }[];
  isMe?: boolean;
  isDemo?: boolean;
}

function profitLabel(amount: number, rate: number) {
  return `${amount >= 0 ? '+' : '-'}${Math.abs(amount).toLocaleString()}원 (${Math.abs(rate).toFixed(2)}%)`;
}

// 1~3위 포인트. 1위만 glow를 조금 더 준다
const TOP_RANK = [
  { color: '#F5A623', soft: 'rgba(245, 166, 35, 0.12)', glow: '0 0 0 1px rgba(245,166,35,0.35), 0 4px 16px rgba(245,166,35,0.22)' },
  { color: '#9CA3AF', soft: 'rgba(156, 163, 175, 0.12)', glow: '0 0 0 1px rgba(156,163,175,0.28)' },
  { color: '#CD7F32', soft: 'rgba(205, 127, 50, 0.12)', glow: '0 0 0 1px rgba(205,127,50,0.28)' },
] as const;

export default function RankingPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [users, setUsers] = useState<RankUser[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    apiGet<ApiRankUser[]>('/ranking')
      .then(res => {
        if (cancelled) return;
        setUsers(res.data.map(u => ({
          id: u.user_id,
          nickname: u.nickname,
          avatarUrl: u.avatar_url,
          totalAsset: u.total_asset,
          profitAmount: u.profit_amount,
          profitRate: u.profit_rate,
          top3: u.top_holdings.map(h => ({ name: h.name, code: h.code, profitRate: h.profit_rate })),
          isMe: u.is_me,
          isDemo: u.is_demo,
        })));
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  const myRank = users.findIndex(u => u.isMe) + 1;
  const myUser = users.find(u => u.isMe);

  if (status !== 'ready' || users.length === 0) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>랭킹</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>총 자산 기준 실시간 순위</div>
        </div>
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '48px 0', textAlign: 'center', fontSize: 13, color: theme.textMuted,
        }}>
          {status === 'loading' ? '랭킹을 불러오는 중...' : status === 'error' ? '랭킹을 불러오지 못했습니다' : '아직 랭킹에 표시할 사용자가 없습니다'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 헤더 */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>랭킹</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>총 자산 기준 실시간 순위</div>
      </div>

      {/* 내 순위 요약 */}
      {myUser && <div style={{
        background: theme.aiSoft, border: `1px solid ${theme.ai}`,
        borderRadius: 12, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        borderLeft: `4px solid ${theme.ai}`,
      }}>
        <UserAvatar name={myUser.nickname} avatarUrl={myUser.avatarUrl} size={44} accent />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: theme.ai, fontWeight: 700 }}>내 순위</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: theme.ai }}>{myRank}위</span>
            <span style={{ fontSize: 13, color: theme.textMuted }}>{myUser.totalAsset.toLocaleString()}원</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: theme.textMuted }}>수익</div>
          <div style={{
            fontSize: 16, fontWeight: 800, marginTop: 2,
            color: myUser.profitAmount >= 0 ? theme.up : theme.down,
          }}>
            {profitLabel(myUser.profitAmount, myUser.profitRate)}
          </div>
        </div>
      </div>}

      {/* 전체 순위 (1위부터 한 리스트) */}
      <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '48px 1fr 120px 180px 1fr',
          padding: '10px 20px', borderBottom: `1px solid ${theme.border}`,
          fontSize: 11, fontWeight: 700, color: theme.textMuted,
        }}>
          <span>순위</span>
          <span>닉네임</span>
          <span style={{ textAlign: 'right' }}>총 자산</span>
          <span style={{ textAlign: 'right' }}>수익</span>
          <span style={{ textAlign: 'right', paddingRight: 4 }}>TOP 종목</span>
        </div>

        {users.map((user, i) => {
          const rank = i + 1;
          const isMe = !!user.isMe;
          const top = rank <= 3 ? TOP_RANK[rank - 1] : null;
          return (
            <div key={user.id} style={{
              display: 'grid', gridTemplateColumns: '48px 1fr 120px 180px 1fr',
              padding: '13px 20px',
              borderBottom: i < users.length - 1 ? `1px solid ${theme.border}` : 'none',
              alignItems: 'center', fontSize: 13,
              background: isMe ? theme.aiSoft : top ? top.soft : 'transparent',
              boxShadow: top ? top.glow : undefined,
              position: 'relative',
              zIndex: top ? 1 : 0,
            }}>
              <span style={{
                fontWeight: 800,
                color: top ? top.color : theme.textMuted,
                fontSize: top ? 15 : 13,
              }}>{rank}</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ boxShadow: rank === 1 ? `0 0 10px ${TOP_RANK[0].color}55` : undefined, borderRadius: '50%' }}>
                  <UserAvatar name={user.nickname} avatarUrl={user.avatarUrl} size={32} accent={isMe || !!top} />
                </div>
                <span style={{ fontWeight: isMe || top ? 700 : 500 }}>
                  {user.nickname}{user.isDemo && <DemoBadge />}
                  {isMe && <span style={{ fontSize: 11, color: theme.ai, marginLeft: 5, fontWeight: 700 }}>나</span>}
                </span>
              </div>

              <div style={{ textAlign: 'right', fontWeight: 700 }}>
                {(user.totalAsset / 10000).toFixed(0)}만원
              </div>

              <div style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: user.profitAmount >= 0 ? theme.up : theme.down }}>
                {profitLabel(user.profitAmount, user.profitRate)}
              </div>

              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {user.top3.length === 0 && <span style={{ fontSize: 11, color: theme.textMuted }}>보유 종목 없음</span>}
                {user.top3.slice(0, 2).map(s => (
                  <div key={s.code} onClick={() => navigate(`/stock/${s.code}`)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 7px', borderRadius: 6,
                    background: theme.panel2, border: `1px solid ${theme.border}`,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    color: s.profitRate >= 0 ? theme.up : theme.down,
                  }}>
                    <StockLogo name={s.name} code={s.code} size={14} />
                    {s.name.length > 5 ? s.name.slice(0, 5) : s.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
