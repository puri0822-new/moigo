import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { timeAgo } from '../lib/time';
import { useViewport } from '../lib/useViewport';
import {
  fetchMarketIssues, fetchStockTopIssues, fetchWatchlist,
  type ApiIssueStock, type ApiMarketNewsIssue, type ApiNewsIssue,
} from '../lib/api';

type Status = 'loading' | 'ready' | 'error';

function IssueCard({ issue, rank, stocks }: { issue: ApiNewsIssue; rank: number; stocks: ApiIssueStock[] }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ padding: '16px 0', borderBottom: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          fontSize: 16, fontWeight: 800, width: 22, flexShrink: 0, paddingTop: 1,
          color: rank <= 3 ? theme.ai : theme.textMuted,
        }}>{rank}</div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stocks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {stocks.map(s => (
                <span key={s.id} onClick={() => navigate(`/stock/${s.code}`)} style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                  background: theme.panel2, color: theme.text, border: `1px solid ${theme.border}`,
                }}>{s.name}</span>
              ))}
            </div>
          )}
          <a href={issue.url} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 15, fontWeight: 700, lineHeight: 1.45, color: 'inherit', textDecoration: 'none',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{issue.title}</a>
          {issue.summary && (
            <div style={{
              fontSize: 12, color: theme.textMuted, lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{issue.summary}</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 11, color: theme.textMuted }}>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: theme.aiSoft, color: theme.ai, fontWeight: 700 }}>
              언론사 {issue.source_count}곳 보도
            </span>
            {issue.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{ padding: '2px 8px', borderRadius: 999, background: theme.panel2, color: theme.text }}>#{tag}</span>
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
              borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.panel2,
            }}
          />
        )}
      </div>

      {issue.related.length > 0 && (
        <div style={{ paddingLeft: 36 }}>
          <button onClick={() => setOpen(o => !o)} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: theme.textMuted,
          }}>
            {open ? '관련 기사 접기 ▲' : `같은 소식 다른 기사 ${issue.article_count - 1}건 ▼`}
          </button>
          {open && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {issue.related.map(r => (
                <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 12, color: 'inherit', textDecoration: 'none', display: 'flex', gap: 8, minWidth: 0,
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
      flexShrink: 0, cursor: 'pointer', padding: '7px 14px', borderRadius: 999, fontSize: 13,
      fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
      border: `1px solid ${active ? theme.ai : theme.border}`,
      background: active ? theme.aiSoft : theme.panel,
      color: active ? theme.ai : theme.text,
    }}>{watched ? '★ ' : ''}{label}</button>
  );

  return (
    <div style={{ padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920, width: '100%', margin: '0 auto' }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>핵심 뉴스</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>
          최근 7일간 여러 언론사가 함께 다룬 소식을 묶어, 크게 보도된 순서로 보여줍니다
        </div>
      </div>

      <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {chip('인기 종목 전체', selected === null, () => setSelected(null))}
        {chips.map(({ stock, watched }) => chip(stock.name, selected?.id === stock.id, () => setSelected(stock), watched))}
      </div>

      <div style={{
        background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14,
        padding: isMobile ? '4px 14px' : '4px 20px',
      }}>
        {status === 'loading' && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 13, color: theme.textMuted }}>
            {selected ? `${selected.name} 기사를 모아 이슈를 추리는 중...` : '거래대금 상위 종목의 기사를 모아 이슈를 추리는 중... (처음엔 20초 정도 걸려요)'}
          </div>
        )}
        {status === 'error' && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 13, color: theme.textMuted }}>
            핵심 뉴스를 불러오지 못했습니다{' '}
            <button onClick={() => setRetry(r => r + 1)} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: theme.ai, fontSize: 13,
            }}>다시 시도</button>
          </div>
        )}
        {status === 'ready' && (selected ? stockIssues : marketIssues).length === 0 && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 13, color: theme.textMuted }}>
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
