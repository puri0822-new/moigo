import { useTheme } from '../context/ThemeContext';

// 전시용 체험 계정 표시 (랭킹·피드의 닉네임 옆)
export default function DemoBadge() {
  const { theme } = useTheme();
  return (
    <span
      title="전시용 체험 계정입니다"
      style={{
        display: 'inline-block', marginLeft: 5, verticalAlign: 'middle', flexShrink: 0,
        fontSize: 10, fontWeight: 700, lineHeight: 1.4, borderRadius: 4, padding: '0 5px',
        color: theme.textMuted, background: theme.panel2, border: `1px solid ${theme.border}`,
      }}
    >
      체험
    </span>
  );
}
