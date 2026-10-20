import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { apiGet } from '../lib/api';
import StockLogo from '../components/StockLogo';

interface ApiRankUser {
  rank: number;
  user_id: number;
  nickname: string;
  total_asset: number;
  profit_amount: number;
  profit_rate: number;
  top_holdings: { name: string; code: string; profit_rate: number }[];
  is_me: boolean;
}

interface RankUser {
  id: number;
  nickname: string;
  totalAsset: number;
  profitAmount: number;
  profitRate: number;
  top3: { name: string; code: string; profitRate: number }[];
  isMe?: boolean;
}

const medalColors = ['#F5A623', '#A8A8A8', '#CD7F32'];
const medalLabels = ['🥇', '🥈', '🥉'];

function profitLabel(amount: number, rate: number) {
  return `${amount >= 0 ? '+' : '-'}${Math.abs(amount).toLocaleString()}원 (${Math.abs(rate).toFixed(2)}%)`;
}

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
          totalAsset: u.total_asset,
          profitAmount: u.profit_amount,
          profitRate: u.profit_rate,
          top3: u.top_holdings.map(h => ({ name: h.name, code: h.code, profitRate: h.profit_rate })),
          isMe: u.is_me,
        })));
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  const myRank = users.findIndex(u => u.isMe) + 1;
  const myUser = users.find(u => u.isMe);

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);
  // 시상대는 2위·1위·3위 순으로 놓는다. 사용자가 3명보다 적으면 있는 만큼만 보여준다.
  const podium = [{ user: top3[1], rank: 2 }, { user: top3[0], rank: 1 }, { user: top3[2], rank: 3 }]
    .filter((p): p is { user: RankUser; rank: number } => p.user !== undefined);

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
        background: theme.ai, borderRadius: 14, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', right: 40, bottom: -30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{
          width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0,
        }}>
          {myUser.nickname[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>내 순위</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{myRank}위</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{myUser.totalAsset.toLocaleString()}원</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>수익</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: myUser.profitAmount >= 0 ? '#fca5a5' : '#93c5fd', marginTop: 2 }}>
            {profitLabel(myUser.profitAmount, myUser.profitRate)}
          </div>
        </div>
      </div>}

      {/* TOP 3 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        {podium.map(({ user, rank: realRank }) => {
          const isCenter = realRank === 1;
          return (
            <div key={user.id} style={{
              flex: 1, background: theme.panel, border: `2px solid ${isCenter ? medalColors[0] : theme.border}`,
              borderRadius: 14, padding: '18px 14px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              minHeight: realRank === 1 ? 190 : realRank === 2 ? 160 : 150,
              justifyContent: 'center',
              boxShadow: isCenter ? `0 4px 20px ${medalColors[0]}33` : 'none',
              position: 'relative',
            }}>
              <div style={{ fontSize: isCenter ? 28 : 22 }}>{medalLabels[realRank - 1]}</div>
              <div style={{
                width: isCenter ? 48 : 40, height: isCenter ? 48 : 40,
                borderRadius: '50%', background: `${medalColors[realRank - 1]}22`,
                border: `2px solid ${medalColors[realRank - 1]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isCenter ? 18 : 15, fontWeight: 800,
                color: medalColors[realRank - 1],
              }}>
                {user.nickname[0]?.toUpperCase()}
              </div>
              <div style={{ fontSize: isCenter ? 14 : 13, fontWeight: 700, textAlign: 'center' }}>{user.nickname}</div>
              <div style={{ fontSize: isCenter ? 15 : 13, fontWeight: 800 }}>{(user.totalAsset / 10000).toFixed(0)}만원</div>
              <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: user.profitAmount >= 0 ? theme.up : theme.down }}>
                {profitLabel(user.profitAmount, user.profitRate)}
              </div>
              {/* Top3 투자 종목 */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 2 }}>
                {user.top3.map(s => (
                  <div key={s.code} onClick={() => navigate(`/stock/${s.code}`)} style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '2px 6px', borderRadius: 6,
                    background: theme.panel2, border: `1px solid ${theme.border}`,
                    fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    color: s.profitRate >= 0 ? theme.up : theme.down,
                  }}>
                    <StockLogo name={s.name} code={s.code} size={12} />
                    {s.name.length > 4 ? s.name.slice(0, 4) : s.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4위 이하 리스트 */}
      {rest.length > 0 && <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {/* 컬럼 헤더 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '48px 1fr 120px 180px 1fr',
          padding: '10px 20px', borderBottom: `1px solid ${theme.border}`,
          fontSize: 11, fontWeight: 700, color: theme.textMuted,
        }}>
          <span>순위</span>
          <span>닉네임</span>
          <span style={{ textAlign: 'right' }}>총 자산</span>
          <span style={{ textAlign: 'right' }}>수익</span>
          <span style={{ textAlign: 'right', paddingRight: 4 }}>TOP 3 종목</span>
        </div>

        {rest.map((user, i) => {
          const rank = i + 4;
          const isMe = user.isMe;
          return (
            <div key={user.id} style={{
              display: 'grid', gridTemplateColumns: '48px 1fr 120px 180px 1fr',
              padding: '13px 20px', borderBottom: `1px solid ${theme.border}`,
              alignItems: 'center', fontSize: 13,
              background: isMe ? theme.aiSoft : 'transparent',
            }}>
              <span style={{ fontWeight: 700, color: theme.textMuted }}>{rank}</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: isMe ? theme.ai : theme.panel2,
                  border: `1px solid ${isMe ? theme.ai : theme.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  color: isMe ? '#fff' : theme.textMuted,
                  flexShrink: 0,
                }}>
                  {user.nickname[0]?.toUpperCase()}
                </div>
                <span style={{ fontWeight: isMe ? 700 : 500 }}>
                  {user.nickname}{isMe && <span style={{ fontSize: 11, color: theme.ai, marginLeft: 5, fontWeight: 700 }}>나</span>}
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
                {user.top3.map(s => (
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
      </div>}
    </div>
  );
}
