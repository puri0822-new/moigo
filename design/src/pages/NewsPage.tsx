import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { timeAgo } from '../lib/time';
import { useViewport } from '../lib/useViewport';
import {
  fetchMarketIssues, fetchStockTopIssues, fetchWatchlist,
  type ApiIssueStock, type ApiMarketNewsIssue, type ApiNewsIssue,
} from '../lib/api';
import { FS, FW, RADIUS } from '../lib/tokens';
import Pressable from '../components/Pressable';

type Status = 'loading' | 'ready' | 'error';

const SENTIMENT_LABEL = { POSITIVE: '호재', NEUTRAL: '중립', NEGATIVE: '악재' } as const;

// 호재는 빨강, 악재는 파랑 (국내 증시 상승·하락 색과 같게)
function SentimentBadge({ sentiment, reason }: { sentiment: ApiNewsIssue['sentiment']; reason: string | null }) {
  const { theme } = useTheme();
  if (!sentiment) return null;
  const color = sentiment === 'POSITIVE' ? theme.up : sentiment === 'NEGATIVE' ? theme.down : theme.textMuted;
  return (
    <span title={reason ? `AI 판단: ${reason}` : 'AI 판단'} style={{
      flexShrink: 0, fontSize: FS.caption, fontWeight: FW.bold, padding: '2px 8px', borderRadius: RADIUS.md, marginTop: 2, cursor: 'help',
      color, border: `1px solid ${color}`, background: theme.panel,
    }}>{SENTIMENT_LABEL[sentiment]}</span>
  );
}

function IssueCard({ issue, rank, stocks }: { issue: ApiNewsIssue; rank: number; stocks: ApiIssueStock[] }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ padding: '16px 0', borderBottom: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{
          fontSize: FS.title, fontWeight: FW.bold, width: 22, flexShrink: 0, paddingTop: 2,
          color: rank <= 3 ? theme.aiFg : theme.textMuted,
        }}>{rank}</div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stocks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stocks.map(s => (
                <Pressable as="span" key={s.id} onClick={() => navigate(`/stock/${s.code}`)} style={{
                  fontSize: FS.caption, fontWeight: FW.semibold, padding: '2px 8px', borderRadius: RADIUS.md, cursor: 'pointer',
                  background: theme.panel2, color: theme.text, border: `1px solid ${theme.border}`,
                }}>{s.name}</Pressable>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <SentimentBadge sentiment={issue.sentiment} reason={issue.sentiment_reason} />
            <a href={issue.url} target="_blank" rel="noopener noreferrer" style={{
              flex: 1, minWidth: 0,
              fontSize: FS.title, fontWeight: FW.semibold, lineHeight: 1.45, color: 'inherit', textDecoration: 'none',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{issue.title}</a>
          </div>
          {issue.sentiment_reason && (
            <div style={{ fontSize: FS.caption, color: theme.textMuted, lineHeight: 1.5 }}>
              <span style={{ color: theme.aiFg, fontWeight: FW.semibold }}>AI</span> {issue.sentiment_reason}
            </div>
          )}
          {issue.summary && (
            <div style={{
              fontSize: FS.caption, color: theme.textMuted, lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{issue.summary}</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: FS.caption, color: theme.textMuted }}>
            <span style={{ padding: '2px 8px', borderRadius: RADIUS.pill, background: theme.aiSoft, color: theme.aiFg, fontWeight: FW.semibold }}>
              언론사 {issue.source_count}곳 보도
            </span>
            {issue.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{ padding: '2px 8px', borderRadius: RADIUS.pill, background: theme.panel2, color: theme.text }}>#{tag}</span>
            ))}
            <span>최근 보도 {timeAgo(issue.latest_published_at)}</span>
          </div>
        </div>

        {issue.image_url && (
          <img
            src={issue.image_url} alt="" loading="lazy" referrerPolicy="no-referrer"
            onError={e => { e.currentTarget.style.display = 'none'; }}
            style={{
              width: 112, height: 76, flexShrink: 0, objectFit: 'cover',
              borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.panel2,
            }}
          />
        )}
      </div>

      {issue.related.length > 0 && (
        <div style={{ paddingLeft: 40 }}>
          <button onClick={() => setOpen(o => !o)} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: FS.caption, color: theme.textMuted,
          }}>
            {open ? '관련 기사 접기 ▲' : `같은 소식 다른 기사 ${issue.article_count - 1}건 ▼`}
          </button>
          {open && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {issue.related.map(r => (
                <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: FS.caption, color: 'inherit', textDecoration: 'none', display: 'flex', gap: 8, minWidth: 0,
                }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {r.title}</span>
                  <span style={{ color: theme.textMuted, flexShrink: 0 }}>{r.source ?? ''}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewsPage() {
  const { theme } = useTheme();
  const { isMobile } = useViewport();

  // null = 인기 종목 전체
  const [selected, setSelected] = useState<ApiIssueStock | null>(null);
  const [marketIssues, setMarketIssues] = useState<ApiMarketNewsIssue[]>([]);
  const [marketStatus, setMarketStatus] = useState<Status>('loading');
  const [stockIssues, setStockIssues] = useState<ApiNewsIssue[]>([]);
  const [stockStatus, setStockStatus] = useState<Status>('loading');
  const [watchStocks, setWatchStocks] = useState<ApiIssueStock[]>([]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setMarketStatus('loading');
    fetchMarketIssues()
      .then(data => { if (!cancelled) { setMarketIssues(data); setMarketStatus('ready'); } })
      .catch(() => { if (!cancelled) setMarketStatus('error'); });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    fetchWatchlist()
      .then(res => setWatchStocks(res.data.items.map(w => ({ id: w.stock_id, code: w.stock_code, name: w.stock_name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setStockStatus('loading');
    fetchStockTopIssues(selected.id, 10)
      .then(data => { if (!cancelled) { setStockIssues(data); setStockStatus('ready'); } })
      .catch(() => { if (!cancelled) setStockStatus('error'); });
    return () => { cancelled = true; };
  }, [selected, retry]);

  // 종목 칩: 내 관심 종목 먼저, 이어서 지금 이슈에 등장한 인기 종목
  const chips = useMemo(() => {
    const seen = new Set<number>();
    const list: { stock: ApiIssueStock; watched: boolean }[] = [];
    for (const s of watchStocks) {
      if (!seen.has(s.id)) { seen.add(s.id); list.push({ stock: s, watched: true }); }
    }
    for (const issue of marketIssues) {
      for (const s of issue.stocks) {
        if (!seen.has(s.id)) { seen.add(s.id); list.push({ stock: s, watched: false }); }
      }
    }
    return list;
  }, [watchStocks, marketIssues]);

  const status = selected ? stockStatus : marketStatus;
  const chip = (label: string, active: boolean, onClick: () => void, watched = false) => (
    <button key={label} onClick={onClick} style={{
      flexShrink: 0, cursor: 'pointer', padding: '8px 16px', borderRadius: RADIUS.pill, fontSize: FS.body,
      fontWeight: active ? FW.semibold : FW.medium, whiteSpace: 'nowrap',
      border: `1px solid ${active ? theme.ai : theme.border}`,
      background: active ? theme.aiSoft : theme.panel,
      color: active ? theme.aiFg : theme.text,
    }}>{watched ? '★ ' : ''}{label}</button>
  );

  return (
    <div style={{ padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: FS.heading, fontWeight: FW.bold }}>핵심 뉴스</div>
        <div style={{ fontSize: FS.body, color: theme.textMuted, marginTop: 4 }}>
          최근 7일간 여러 언론사가 함께 다룬 소식을 묶어, 크게 보도된 순서로 보여줍니다
        </div>
      </div>

      <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {chip('인기 종목 전체', selected === null, () => setSelected(null))}
        {chips.map(({ stock, watched }) => chip(stock.name, selected?.id === stock.id, () => setSelected(stock), watched))}
      </div>

      <div style={{
        background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg,
        padding: isMobile ? '4px 16px' : '4px 20px',
      }}>
        {status === 'loading' && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: FS.body, color: theme.textMuted }}>
            {selected ? `${selected.name} 기사를 모아 이슈를 추리는 중...` : '거래대금 상위 종목의 기사를 모아 이슈를 추리는 중... (처음엔 20초 정도 걸려요)'}
          </div>
        )}
        {status === 'error' && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: FS.body, color: theme.textMuted }}>
            핵심 뉴스를 불러오지 못했습니다{' '}
            <button onClick={() => setRetry(r => r + 1)} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: theme.aiFg, fontSize: FS.body,
            }}>다시 시도</button>
          </div>
        )}
        {status === 'ready' && (selected ? stockIssues : marketIssues).length === 0 && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: FS.body, color: theme.textMuted }}>
            최근 크게 다뤄진 이슈가 없습니다
          </div>
        )}
        {status === 'ready' && (selected
          ? stockIssues.map((issue, i) => <IssueCard key={issue.url} issue={issue} rank={i + 1} stocks={[selected]} />)
          : marketIssues.map((issue, i) => <IssueCard key={issue.url} issue={issue} rank={i + 1} stocks={issue.stocks} />)
        )}
      </div>
    </div>
  );
}
