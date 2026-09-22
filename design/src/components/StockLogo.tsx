import { useTheme } from '../context/ThemeContext';

interface StockLogoProps {
  name: string;
  size?: number;
}

export default function StockLogo({ name, size = 36 }: StockLogoProps) {
  const { theme } = useTheme();
  const radius = Math.round(size * 0.25);

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: radius,
      border: `1px dashed ${theme.border}`,
      background: theme.panel2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: theme.textMuted,
      fontSize: Math.round(size * 0.38),
      fontWeight: 700,
      userSelect: 'none',
    }}>
      {name.charAt(0)}
    </div>
  );
}
