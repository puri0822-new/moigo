import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import StockLogo from '../components/StockLogo';

interface RankUser {
  id: number;
  nickname: string;
  totalAsset: number;
  profitAmount: number;
  profitRate: number;
  top3: { name: string; code: string; profitRate: number }[];
  isMe?: boolean;
}

const mockUsers: RankUser[] = [
  { id: 1,  nickname: '퀀트킹',    totalAsset: 38_200_000, profitAmount: 8_200_000, profitRate: 27.4, top3: [{ name: '삼성전자', code: '005930', profitRate: 18.2 }, { name: 'SK하이닉스', code: '000660', profitRate: 31.5 }, { name: '카카오', code: '035720', profitRate: 12.0 }] },
  { id: 2,  nickname: '주식요정',   totalAsset: 33_750_000, profitAmount: 6_750_000, profitRate: 25.0, top3: [{ name: '현대차', code: '005380', profitRate: 22.1 }, { name: 'POSCO홀딩스', code: '005490', profitRate: 14.3 }, { name: '삼성바이오로직스', code: '207940', profitRate: 8.7 }] },
  { id: 3,  nickname: 'AlphaBot',   totalAsset: 29_100_000, profitAmount: 4_100_000, profitRate: 16.4, top3: [{ name: 'LG에너지솔루션', code: '373220', profitRate: 19.8 }, { name: '삼성전자', code: '005930', profitRate: 11.2 }, { name: 'NAVER', code: '035420', profitRate: 9.5 }] },
  { id: 4,  nickname: '가을하늘',   totalAsset: 26_440_000, profitAmount: 3_440_000, profitRate: 14.9, top3: [{ name: 'SK하이닉스', code: '000660', profitRate: 20.3 }, { name: '카카오', code: '035720', profitRate: 7.1 }, { name: 'KB금융', code: '105560', profitRate: 5.4 }] },
  { id: 5,  nickname: 'TechSurfer', totalAsset: 24_900_000, profitAmount: 2_900_000, profitRate: 13.2, top3: [{ name: 'NAVER', code: '035420', profitRate: 16.7 }, { name: '삼성SDI', code: '006400', profitRate: 11.9 }, { name: '현대모비스', code: '012330', profitRate: 4.2 }] },
  { id: 6,  nickname: '별빛투자자',  totalAsset: 22_300_000, profitAmount: 2_300_000, profitRate: 11.5, top3: [{ name: '셀트리온', code: '068270', profitRate: 13.4 }, { name: '삼성전자', code: '005930', profitRate: 8.8 }, { name: '기아', code: '000270', profitRate: 6.1 }] },
  { id: 7,  nickname: '밸류헌터',   totalAsset: 20_100_000, profitAmount: 1_800_000, profitRate: 9.8,  top3: [{ name: '현대차', code: '005380', profitRate: 12.0 }, { name: 'KB금융', code: '105560', profitRate: 7.3 }, { name: 'LG화학', code: '051910', profitRate: 3.5 }] },
  { id: 8,  nickname: '모닝스타',   totalAsset: 18_650_000, profitAmount: 1_450_000, profitRate: 8.4,  top3: [{ name: '카카오', code: '035720', profitRate: 10.2 }, { name: 'SK하이닉스', code: '000660', profitRate: 6.8 }, { name: 'POSCO홀딩스', code: '005490', profitRate: 2.9 }] },
  { id: 9,  nickname: '나',         totalAsset: 15_680_000, profitAmount:   480_000, profitRate: 3.2,  top3: [{ name: '삼성전자', code: '005930', profitRate: 4.0 }, { name: 'SK하이닉스', code: '000660', profitRate: 2.1 }, { name: 'NAVER', code: '035420', profitRate: -1.3 }], isMe: true },
  { id: 10, nickname: '파란하늘',   totalAsset: 13_200_000, profitAmount:   200_000, profitRate: 1.5,  top3: [{ name: '기아', code: '000270', profitRate: 3.2 }, { name: '셀트리온', code: '068270', profitRate: 0.8 }, { name: '삼성SDI', code: '006400', profitRate: -1.2 }] },
  { id: 11, nickname: '신중투자',   totalAsset: 11_900_000, profitAmount:  -100_000, profitRate: -0.8, top3: [{ name: '현대모비스', code: '012330', profitRate: 1.1 }, { name: 'LG화학', code: '051910', profitRate: -2.3 }, { name: '삼성바이오로직스', code: '207940', profitRate: -0.5 }] },
  { id: 12, nickname: '초보개미',   totalAsset: 10_350_000, profitAmount:  -650_000, profitRate: -5.9, top3: [{ name: 'LG에너지솔루션', code: '373220', profitRate: -4.1 }, { name: 'NAVER', code: '035420', profitRate: -7.2 }, { name: 'KB금융', code: '105560', profitRate: -1.8 }] },
];

const periods = ['일간', '주간', '전체'] as const;
const medalColors = ['#F5A623', '#A8A8A8', '#CD7F32'];
const medalLabels = ['🥇', '🥈', '🥉'];

export default function RankingPage() {
  const { theme } = useTheme();
  const { nickname } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<(typeof periods)[number]>('전체');

  const myNickname = nickname || '나';
  const users = mockUsers.map(u => u.isMe ? { ...u, nickname: myNickname } : u);
  const myRank = users.findIndex(u => u.isMe) + 1;
  const myUser = users.find(u => u.isMe)!;

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>랭킹</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>총 자산 기준 실시간 순위</div>
        </div>
        <div style={{ display: 'flex', background: theme.panel2, borderRadius: 10, padding: 3, gap: 3, border: `1px solid ${theme.border}` }}>
          {periods.map(p => (
            <div key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: period === p ? theme.ai : 'transparent',
              color: period === p ? '#fff' : theme.textMuted,
            }}>{p}</div>
          ))}
        </div>
      </div>

      {/* 내 순위 요약 */}
      <div style={{
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
          {myNickname[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>내 순위</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{myRank}위</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{myUser.totalAsset.toLocaleString()}원</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>수익률</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: myUser.profitRate >= 0 ? '#fca5a5' : '#93c5fd', marginTop: 2 }}>
            {myUser.profitRate >= 0 ? '+' : ''}{myUser.profitRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* TOP 3 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        {[top3[1], top3[0], top3[2]].map((user, visualIdx) => {
          const realRank = visualIdx === 0 ? 2 : visualIdx === 1 ? 1 : 3;
          const heights = [160, 190, 150];
          const isCenter = visualIdx === 1;
          return (
            <div key={user.id} style={{
              flex: 1, background: theme.panel, border: `2px solid ${isCenter ? medalColors[0] : theme.border}`,
              borderRadius: 14, padding: '18px 14px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              minHeight: heights[visualIdx],
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
              <div style={{ fontSize: 12, fontWeight: 700, color: user.profitRate >= 0 ? theme.up : theme.down }}>
                {user.profitRate >= 0 ? '+' : ''}{user.profitRate.toFixed(1)}%
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
      <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {/* 컬럼 헤더 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '48px 1fr 120px 100px 1fr',
          padding: '10px 20px', borderBottom: `1px solid ${theme.border}`,
          fontSize: 11, fontWeight: 700, color: theme.textMuted,
        }}>
          <span>순위</span>
          <span>닉네임</span>
          <span style={{ textAlign: 'right' }}>총 자산</span>
          <span style={{ textAlign: 'right' }}>수익률</span>
          <span style={{ textAlign: 'right', paddingRight: 4 }}>TOP 3 종목</span>
        </div>

        {rest.map((user, i) => {
          const rank = i + 4;
          const isMe = user.isMe;
          return (
            <div key={user.id} style={{
              display: 'grid', gridTemplateColumns: '48px 1fr 120px 100px 1fr',
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

              <div style={{ textAlign: 'right', fontWeight: 700, color: user.profitRate >= 0 ? theme.up : theme.down }}>
                {user.profitRate >= 0 ? '+' : ''}{user.profitRate.toFixed(1)}%
              </div>

              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
      </div>
    </div>
  );
}
