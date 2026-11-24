import { useNavigate } from 'react-router-dom';
import AiIcon from './AiIcon';
import StockLogo from './StockLogo';
import { consensusPicks, topPickPerModel } from '../lib/aiRecommendations';
import type { AiRecommendation } from '../lib/aiRecommendations';
import { findAiProfile, useAiModels } from '../lib/aiModels';
import { FS, FW, RADIUS, ON_BRAND } from '../lib/tokens';
import Pressable from './Pressable';

const VERDICT = {
  BUY: { label: '매수', color: ON_BRAND.up },
  SELL: { label: '매도', color: ON_BRAND.down },
  SPLIT: { label: '의견 갈림', color: 'rgba(255,255,255,0.75)' },
} as const;

// AI 분석 배너 오른쪽: 여러 AI가 함께 고른 종목. 없는 날은 AI별로 확신도가 가장 높은 추천
export default function AiConsensusPanel({ current }: { current: AiRecommendation[] }) {
  const navigate = useNavigate();
  const models = useAiModels();
  const picks = consensusPicks(current);
  const tops = picks.length ? [] : topPickPerModel(current);
  if (!picks.length && !tops.length) return null;

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: RADIUS.md, cursor: 'pointer',
    background: 'rgba(255,255,255,0.1)',
  } as const;
  const iconBox = (model: string) => (
    <div key={model} style={{
      width: 18, height: 18, borderRadius: RADIUS.sm, background: '#fff', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <AiIcon model={model} size={13} />
    </div>
  );

  return (
    <div style={{
      position: 'relative', width: 300, flexShrink: 0, alignSelf: 'stretch',
      background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: RADIUS.lg,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: FS.body, fontWeight: FW.bold, color: '#fff' }}>{picks.length ? 'AI 공통 픽' : 'AI별 주목 종목'}</span>
        <span style={{ fontSize: FS.caption, color: 'rgba(255,255,255,0.6)' }}>
          {picks.length ? '여러 AI가 함께 고른 종목' : '확신도가 가장 높은 추천'}
        </span>
      </div>

      {picks.map(p => {
        const v = VERDICT[p.verdict];
        return (
          <Pressable key={p.stockCode} onClick={() => navigate(`/stock/${p.stockCode}`)} style={rowStyle}>
            <StockLogo name={p.stockName} code={p.stockCode} size={24} />
            <span style={{ fontSize: FS.body, fontWeight: FW.semibold, color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.stockName}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>{p.models.map(iconBox)}</div>
            <span style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: v.color, flexShrink: 0, minWidth: 44, textAlign: 'right' }}>
              {p.verdict === 'SPLIT' ? v.label : `${v.label} ${p.models.length}`}
            </span>
          </Pressable>
        );
      })}

      {tops.map(r => {
        const v = VERDICT[r.opinion];
        return (
          <Pressable key={r.id} onClick={() => navigate(`/stock/${r.stockCode}`)} style={rowStyle}>
            {iconBox(r.aiModel)}
            <span style={{ fontSize: FS.caption, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>{findAiProfile(models, r.aiModel).name}</span>
            <span style={{ fontSize: FS.body, fontWeight: FW.semibold, color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.stockName}
            </span>
            <span style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: v.color, flexShrink: 0 }}>
              {v.label}{r.confidence != null ? ` ${r.confidence}` : ''}
            </span>
          </Pressable>
        );
      })}
    </div>
  );
}
