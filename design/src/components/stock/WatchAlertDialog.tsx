import { useTheme } from '../../context/ThemeContext';
import StockLogo from '../StockLogo';
import { FS, FW, RADIUS } from '../../lib/tokens';
import Pressable from '../Pressable';

interface WatchAlertDialogProps {
  stockName: string;
  stockCode: string;
  onAnswer: (enable: boolean) => void;
}

// 관심 종목에 추가한 직후 급등락 알림을 받을지 묻는다
export default function WatchAlertDialog({ stockName, stockCode, onAnswer }: WatchAlertDialogProps) {
  const { theme } = useTheme();
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={() => onAnswer(false)}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 340, maxWidth: 'calc(100vw - 32px)', background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: RADIUS.xl, padding: '24px 20px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <StockLogo name={stockName} code={stockCode} size={44} />
          <div style={{ fontSize: FS.title, fontWeight: FW.bold }}>관심 종목에 추가했어요</div>
          <div style={{ fontSize: FS.body, lineHeight: 1.6 }}>
            <b>{stockName}</b> 주가가 <b>5% 이상</b> 오르거나 내리면<br />알려드릴까요?
          </div>
          <div style={{ fontSize: FS.caption, color: theme.textMuted, lineHeight: 1.6 }}>
            전일 종가 대비 5%, 10%, 15%… 를 넘을 때마다<br />오른쪽 위 알림에 표시돼요. 회원 설정에서 끌 수 있어요.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Pressable
            onClick={() => onAnswer(false)}
            style={{
              flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: RADIUS.md,
              border: `1px solid ${theme.border}`, fontSize: FS.body, fontWeight: FW.medium,
              color: theme.textMuted, cursor: 'pointer',
            }}
          >괜찮아요</Pressable>
          <Pressable
            onClick={() => onAnswer(true)}
            style={{
              flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: RADIUS.md,
              background: theme.ai, color: '#fff', fontWeight: FW.semibold, fontSize: FS.body, cursor: 'pointer',
            }}
          >알림 받기</Pressable>
        </div>
      </div>
    </div>
  );
}
