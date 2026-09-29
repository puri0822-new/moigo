import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

interface StockLogoProps {
  name: string;
  code?: string;
  size?: number;
}

export default function StockLogo({ name, code, size = 36 }: StockLogoProps) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.25);

  if (code && !failed) {
    return (
      <img
        src={`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${code}.png`}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{
          width: size, height: size, flexShrink: 0,
          borderRadius: radius,
          objectFit: 'contain',
          border: `1px solid ${theme.border}`,
          background: theme.panel2,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: radius,
      border: `1px solid ${theme.border}`,
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
