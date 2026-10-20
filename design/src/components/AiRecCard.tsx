import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import AiIcon from './AiIcon';
import StockLogo from './StockLogo';
import { useAiRecommendations } from '../lib/aiRecommendations';
import type { AiRecommendation } from '../lib/aiRecommendations';
import { findAiProfile, useAiModels } from '../lib/aiModels';

const ROTATE_MS = 6000;

// 아직 결과가 나오지 않은 AI 추천을 6초마다 하나씩 돌려 보여주는 카드 (오른쪽 패널, 종목 상세)
export default function AiRecCard() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const models = useAiModels();
  const { current: recs } = useAiRecommendations();
  // 같은 AI 추천이 연달아 나오지 않게 AI별로 번갈아 세운다 (Claude → Gemini → CLOVA → Claude ...)
  const current = interleaveByModel(recs);
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (current.length < 2) return;
    const timer = setInterval(() => setIndex(prev => prev + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, [current.length]);

  if (hidden || current.length === 0) return null;
  const rec = current[index % current.length];
  const ai = findAiProfile(models, rec.aiModel);
  const isBuy = rec.opinion === 'BUY';

  return (
    <div
      onClick={() => navigate(`/stock/${rec.stockCode}`)}
      style={{
        background: theme.ai, borderRadius: 14, padding: '20px 18px',
        display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer',
        position: 'relative', overflow: 'hidden', minHeight: 180, flexShrink: 0,
      }}
    >
      <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', right: 20, bottom: -30, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

      <div key={`rec-header-${rec.id}`} className="ai-rec-slide" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <AiIcon model={rec.aiModel} size={20} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
          {ai.name} · {rec.periodType === 'WEEKLY' ? '1주' : '1달'} 추천
        </span>
        <div
          onClick={e => { e.stopPropagation(); setHidden(true); }}
          style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}
        >✕</div>
      </div>

      <div key={`rec-body-${rec.id}`} className="ai-rec-slide">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <StockLogo name={rec.stockName} code={rec.stockCode} size={20} />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{rec.stockName}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '2px 7px',
            color: isBuy ? '#fca5a5' : '#93c5fd', border: `1px solid ${isBuy ? '#fca5a5' : '#93c5fd'}`,
          }}>
            {isBuy ? '매수' : '매도'}
          </span>
        </div>
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, wordBreak: 'keep-all',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {rec.reason}
        </div>
      </div>
    </div>
  );
}

function interleaveByModel(recs: AiRecommendation[]): AiRecommendation[] {
  const byModel = new Map<string, AiRecommendation[]>();
  for (const r of recs) byModel.set(r.aiModel, [...(byModel.get(r.aiModel) ?? []), r]);
  const queues = [...byModel.values()];
  const out: AiRecommendation[] = [];
  for (let i = 0; out.length < recs.length; i++) {
    for (const q of queues) if (q[i]) out.push(q[i]);
  }
  return out;
}
