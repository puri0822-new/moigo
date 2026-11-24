import { useTheme } from '../context/ThemeContext';
import { assetUrl } from '../lib/api';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  /** 강조(나 / 상위 등). 이니셜 배경에만 쓴다 */
  accent?: boolean;
}

/** 프로필 사진이 있으면 원형 이미지, 없으면 닉네임 이니셜 */
export default function UserAvatar({ name, avatarUrl, size = 32, accent = false }: UserAvatarProps) {
  const { theme } = useTheme();
  const initial = (name || '?').slice(0, 1).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={assetUrl(avatarUrl)}
        alt=""
        width={size}
        height={size}
        style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0,
          objectFit: 'cover', border: `1px solid ${theme.border}`,
          background: theme.panel2,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800,
      background: accent ? theme.aiSoft : theme.panel2,
      color: accent ? theme.ai : theme.textMuted,
      border: `1px solid ${accent ? theme.ai : theme.border}`,
    }}>
      {initial}
    </div>
  );
}
